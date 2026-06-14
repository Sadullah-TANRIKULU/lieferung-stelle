# Database Schema & Migration Guide

## Current Production Schema

### 1. `customers` table
```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  customer_code VARCHAR(20) UNIQUE NOT NULL,
  address VARCHAR(255)
);
```

### 2. `products` table
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,  -- Can store comma-separated units (e.g., "kg,Stück,Kiste")
  image_url TEXT
);
```

### 3. `orders` table
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### 4. `order_items` table
```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity NUMERIC NOT NULL,  -- Supports decimal values (1.5 kg, 2.3 boxes, etc.)
  status VARCHAR(20) DEFAULT 'open',  -- Values: 'open', 'delivered', 'refused'
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

## ⚠️ RECOMMENDED MIGRATION (Optional but Strongly Advised)

To fully support flexible units (kg, Stück, Kiste, etc.), add this column to `order_items`:

```sql
ALTER TABLE order_items 
ADD COLUMN unit VARCHAR(20) DEFAULT 'Stück';

-- Update existing records if needed
UPDATE order_items SET unit = 'Stück' WHERE unit IS NULL;
```

This allows the system to store:
- 2.5 kg apples
- 1 box (Kiste) of lettuce
- 50 pieces (Stück) of tomatoes
- 3 bundles (Bund) of carrots

## Example Workflow

### 1. Customer Places Order
Frontend sends:
```json
{
  "customer_code": "CUST001",
  "items": [
    { "product_id": 1, "quantity": 2.5, "unit": "kg" },
    { "product_id": 2, "quantity": 1, "unit": "Kiste" },
    { "product_id": 3, "quantity": 50, "unit": "Stück" }
  ]
}
```

### 2. Backend Stores Order
After inserting to `orders`, inserts to `order_items`:
```
order_id: 42, product_id: 1, quantity: 2.5, unit: "kg", status: "open"
order_id: 42, product_id: 2, quantity: 1, unit: "Kiste", status: "open"
order_id: 42, product_id: 3, quantity: 50, unit: "Stück", status: "open"
```

### 3. Loading Summary Aggregates
Query groups by product and unit:
```sql
SELECT p.name, oi.unit, SUM(oi.quantity) as total
FROM order_items oi
JOIN products p ON oi.product_id = p.id
WHERE o.delivery_date = CURRENT_DATE
GROUP BY p.name, oi.unit;
```

Result:
```
Apples, kg, 7.5
Lettuce, Kiste, 3
Tomatoes, Stück, 150
```

## Phase Architecture

The system manages 5 distinct phases:

### 1. **Bestellung (Customer Order Entry)**
- URL: `bestellung.html?code=CUSTOMER_CODE`
- User: Customer with QR code
- Actions: Select products, quantities, units → Submit order
- Data Flow: Frontend → POST /api/orders

### 2. **Admin (Product Management)**
- URL: `admin.html` (requires localStorage isAdmin=true)
- User: Logistics admin
- Actions: Create products, set units (comma-separated options)
- Data Flow: Frontend → POST /api/products

### 3. **Lade-Übersicht (Loading Summary)**
- URL: `loading.html` (requires admin authentication)
- User: Warehouse staff preparing shipment
- Actions: View aggregated quantities per product/unit
- Data Flow: GET /api/loading-summary

### 4. **Fahrer-Tour (Delivery Tour)**
- URL: `tour.html` (requires admin authentication)
- User: Delivery driver
- Actions: View route, mark items as delivered/refused, update status
- Data Flow: GET /api/delivery-tour, PATCH /api/update-status

### 5. **Scan Entry Point**
- URL: `scan.html`
- User: Anyone
- Actions: Logout endpoint, shows QR code for re-entry
- Data Flow: Redirects after logout

## Security Notes

- **Customer access**: Protected by `customerCode` in localStorage
- **Admin access**: Protected by `isAdmin` flag in localStorage + `x-admin-key` header on API calls
- **Server validation**: Always validate `x-admin-key` header on protected endpoints
- **Current admin key**: `ich-liebe-naime` (should be moved to environment variable)

## Environment Variables

```
DATABASE_URL=postgresql://user:password@host:port/database
ADMIN_SECRET=ich-liebe-naime
PORT=3000
```

## Common Queries

### View all orders for today
```sql
SELECT 
  c.name as customer, 
  p.name as product, 
  oi.quantity, 
  oi.unit,
  oi.status
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN customers c ON o.customer_id = c.id
JOIN products p ON oi.product_id = p.id
WHERE DATE(o.created_at) = CURRENT_DATE
ORDER BY c.name, p.name;
```

### Summary by customer for loading
```sql
SELECT 
  c.name as customer,
  COUNT(DISTINCT oi.product_id) as item_types,
  SUM(oi.quantity) as total_units
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN customers c ON o.customer_id = c.id
WHERE DATE(o.created_at) = CURRENT_DATE
GROUP BY c.name
ORDER BY c.name;
```

### Product totals needed for day
```sql
SELECT 
  p.name as product,
  SUM(oi.quantity) as total_quantity,
  oi.unit
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE DATE(o.created_at) = CURRENT_DATE
GROUP BY p.id, p.name, oi.unit
ORDER BY p.name;
```
