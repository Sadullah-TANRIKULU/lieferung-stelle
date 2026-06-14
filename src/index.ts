import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { query } from "./db";
import fs from "fs";
import path from "path";

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
  const { customer_code, items } = req.body; // items: [{product_id: 1, quantity: 5, unit: "kg"}, ...]

  console.log("Daten vom Frontend erhalten:", req.body);

  try {
    // 1. Kunden-ID anhand des Codes finden
    const customer = await query(
      "SELECT id FROM customers WHERE customer_code = $1",
      [customer_code],
    );
    if (customer.rows.length === 0)
      return res.status(404).send("Kunde nicht gefunden");

    // 2. Bestellung mit aktuellem Datum anlegen
    const order = await query(
      "INSERT INTO orders (customer_id, delivery_date) VALUES ($1, CURRENT_DATE) RETURNING id",
      [customer.rows[0].id],
    );
    const orderId = order.rows[0].id;

    // 3. Positionen einfügen (mit Einheit)
    for (const item of items) {
      // Try to use unit if provided, otherwise fallback to just quantity
      const unit = item.unit || "Stück";
      const quantity = parseFloat(item.quantity);
      
      // Check if order_items has a unit column, if not store in quantity as string representation
      await query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit, status) VALUES ($1, $2, $3, $4, $5)",
        [orderId, parseInt(item.product_id), quantity, unit, "open"],
      );
    }

    res.status(201).json({ orderId });
  } catch (err) {
    console.error("Fehler beim Erstellen der Bestellung:", err);
    res.status(500).send("Fehler beim Erstellen der Bestellung");
  }
});

app.get("/api/daily-shopping-list", adminOnly, async (req, res) => {
  try {
    const queryText = `
      SELECT p.name, oi.unit, SUM(oi.quantity) as total_needed
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.name, oi.unit;
    `;
    const result = await query(queryText);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden" });
  }
});

app.patch("/api/update-status/:item_id", adminOnly, async (req, res) => {
  const { item_id } = req.params;
  const { status, driver_note } = req.body; // Erwartet 'delivered' oder 'refused' und optionalen driver_note

  try {
    await query("UPDATE order_items SET status = $1, driver_note = $2 WHERE id = $3", [
      status,
      driver_note ? driver_note.trim() : null,
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
      SELECT oi.id, c.name as customer_name, p.name as product_name, oi.quantity, oi.unit, oi.status, oi.driver_note
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

// Get all orders with details
app.get("/api/orders-list", adminOnly, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        o.id as order_id,
        c.name as customer_name,
        c.customer_code,
        p.name as product_name,
        oi.quantity,
        oi.unit,
        oi.status,
        oi.driver_note,
        o.delivery_date,
        o.created_at
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON oi.product_id = p.id
      ORDER BY o.created_at DESC;
    `;
    const result = await query(queryText);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Bestellungen" });
  }
});

app.get("/api/loading-summary", adminOnly, async (req, res) => {
  try {
    const queryText = `
      SELECT c.name as customer_name, p.name as product_name, SUM(oi.quantity) as quantity, oi.unit
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.delivery_date = CURRENT_DATE
      GROUP BY c.name, p.name, oi.unit
      ORDER BY c.name, p.name;
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

// Assets abrufen (Bilder auflisten)
app.get("/api/assets", adminOnly, (req, res) => {
  const assetsDir = path.join(__dirname, "..", "public", "assets");
  fs.readdir(assetsDir, (err, files) => {
    if (err) {
      console.error("Fehler beim Lesen des Assets-Ordners:", err);
      return res.status(500).json({ error: "Fehler beim Lesen des Assets-Ordners" });
    }
    const imageExtensions = [".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg"];
    const images = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });
    res.json(images);
  });
});

// Admin-Schlüssel validieren
app.get("/api/validate-admin", adminOnly, (req, res) => {
  res.send("OK");
});

// Alle Kunden abrufen
app.get("/api/customers", adminOnly, async (req, res) => {
  try {
    const result = await query("SELECT * FROM customers ORDER BY name ASC;");
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler beim Laden der Kunden:", err);
    res.status(500).json({ error: "Fehler beim Laden der Kunden" });
  }
});

// Neuen Kunden anlegen
app.post("/api/customers", adminOnly, async (req, res) => {
  const { name, customer_code, address } = req.body;
  if (!name || !customer_code) {
    return res.status(400).json({ error: "Name und Kundencode sind Pflichtfelder!" });
  }

  try {
    const result = await query(
      "INSERT INTO customers (name, customer_code, address) VALUES ($1, $2, $3) RETURNING *;",
      [name, customer_code.trim(), address ? address.trim() : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("Fehler beim Erstellen des Kunden:", err);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Dieser Kundencode existiert bereits!" });
    }
    res.status(500).json({ error: "Fehler beim Erstellen des Kunden" });
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});

