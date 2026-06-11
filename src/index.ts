import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { query } from "./db";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static("public"));

const adminOnly = (req: Request, res: Response, next: Function) => {
  const auth = req.headers["x-admin-key"]; // Der Admin schickt einen geheimen Key im Header
  if (auth === process.env.ADMIN_SECRET) {
    next();
  } else {
    res.status(403).send("Zugriff verweigert");
  }
};

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await query("SELECT * FROM customers");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Datenbankabfrage fehlgeschlagen" });
  }
});

app.get("/api/validate-customer", async (req, res) => {
  const { code } = req.query;
  const result = await query(
    "SELECT id FROM customers WHERE customer_code = $1",
    [code],
  );
  result.rows.length > 0 ? res.send("OK") : res.status(404).send("Not Found");
});

// Eine Bestellung speichern
app.post("/api/orders", async (req, res) => {
  const { customer_code, items } = req.body; // items: [{product_id: 1, quantity: 5}, ...]

  console.log("Daten vom Frontend erhalten:", req.body); // FÜGE DAS HINZU

  try {
    // 1. Kunden-ID anhand des Codes finden
    const customer = await query(
      "SELECT id FROM customers WHERE customer_code = $1",
      [customer_code],
    );
    if (customer.rows.length === 0)
      return res.status(404).send("Kunde nicht gefunden");

    // 2. Bestellung anlegen
    const order = await query(
      "INSERT INTO orders (customer_id) VALUES ($1) RETURNING id",
      [customer.rows[0].id],
    );
    const orderId = order.rows[0].id;

    // 3. Positionen einfügen
    for (const item of items) {
      await query(
        "INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)",
        [orderId, parseInt(item.product_id), parseInt(item.quantity)],
      );
    }

    res.status(201).json({ orderId });
  } catch (err) {
    res.status(500).send("Fehler beim Erstellen der Bestellung");
  }
});

app.get("/api/daily-shopping-list", adminOnly, async (req, res) => {
  try {
    const queryText = `
      SELECT p.name, p.unit, SUM(oi.quantity) as total_needed
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.name, p.unit;
    `;
    const result = await query(queryText);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden" });
  }
});

app.patch("/api/update-status/:item_id", adminOnly, async (req, res) => {
  const { item_id } = req.params;
  const { status } = req.body; // Erwartet 'delivered' oder 'refused'

  try {
    await query("UPDATE order_items SET status = $1 WHERE id = $2", [
      status,
      item_id,
    ]);
    res.json({ message: "Status aktualisiert" });
  } catch (err) {
    res.status(500).json({ error: "Status-Update fehlgeschlagen" });
  }
});

// Produkte abrufen
app.get("/api/products", async (req, res) => {
  const result = await query("SELECT * FROM products");
  res.json(result.rows);
});

// Alle Bestellungen für den Fahrer anzeigen
app.get("/api/delivery-tour", adminOnly, async (req, res) => {
  try {
    const queryText = `
      SELECT oi.id, c.name as customer_name, p.name as product_name, oi.quantity, oi.status
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.delivery_date = CURRENT_DATE
ORDER BY o.created_at DESC;
    `;
    const result = await query(queryText);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Tour konnte nicht geladen werden" });
  }
});

app.get("/api/loading-summary", adminOnly, async (req, res) => {
  try {
    const queryText = `
      SELECT c.name as customer_name, SUM(oi.quantity) as total_items
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      GROUP BY c.name
      ORDER BY c.name;
    `;
    const result = await query(queryText);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Lade-Übersicht fehlgeschlagen" });
  }
});

// Produkt hinzufügen
app.post("/api/products", adminOnly, async (req, res) => {
  const { name, unit, image_url } = req.body; // image_url hier hinzufügen
  try {
    await query(
      "INSERT INTO products (name, unit, image_url) VALUES ($1, $2, $3)",
      [name, unit, image_url],
    );
    res.status(201).json({ message: "Produkt mit Bild hinzugefügt" });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Hinzufügen" });
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
