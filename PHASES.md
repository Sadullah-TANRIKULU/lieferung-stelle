# 🎯 Phase Management Guide - Lieferung-Stelle

## Overview: The 5 Phases

This application separates logistics operations into **5 independent phases**, each with its own UI and responsibilities. This modular architecture ensures clear separation of concerns and allows each team member to work independently.

---

## Phase 1: 🛒 Customer Order Entry (Bestellung)

**URL:** `bestellung.html?code=CUSTOMER_CODE`  
**User:** Customer with QR code  
**Duration:** 5-10 minutes per customer  

### What Happens:
1. Customer scans QR code → Load `bestellung.html?code=ABC123`
2. Customer identification is verified via `customerCode` in localStorage
3. Product list loads from database (with images and available units)
4. Customer selects:
   - ✅ Product name
   - ✅ Quantity (as decimal: 1.5, 2.3, etc.)
   - ✅ Unit (kg, Stück, Kiste, Bund, etc.)
5. Real-time order summary displays
6. Submit order → Sent to backend with `customer_code` + items array

### Data Flow:
```
POST /api/orders
{
  "customer_code": "CUST001",
  "items": [
    { "product_id": 1, "quantity": 2.5, "unit": "kg" },
    { "product_id": 2, "quantity": 1, "unit": "Kiste" }
  ]
}
```

### Backend Action:
- Validate customer code
- Create order record with `delivery_date = TODAY`
- Insert order_items with quantities

### UI Features:
- ✅ Mobile-optimized (large buttons, 24px fonts)
- ✅ Large product images (140×140px)
- ✅ Full-width inputs for easy thumb navigation
- ✅ Real-time order summary shows what's been selected
- ✅ Customer code displayed at top
- ✅ Decimal quantity support (1.5 kg apples)

---

## Phase 2: 📦 Product Management (Admin)

**URL:** `admin.html`  
**User:** Logistics administrator (requires `isAdmin = true`)  
**Duration:** Ongoing maintenance  

### What Happens:
1. Admin logs in via `scan.html` → Sets `localStorage.isAdmin = true`
2. Navigates to `admin.html` to add new products
3. Enters:
   - Product name (e.g., "Kartoffeln")
   - Available units (comma-separated: "kg,Stück,Kiste")
   - Image filename (auto-prefixed with `assets/`)
4. Preview image before saving
5. Submit → Stored in `products` table

### Data Flow:
```
POST /api/products
Headers: { "x-admin-key": "ich-liebe-naime" }
{
  "name": "Kartoffeln",
  "unit": "kg,Stück,Kiste",
  "image_url": "assets/kartoffel.jpg"
}
```

### Backend Action:
- Validate `x-admin-key` header (admin authentication)
- Insert product into database
- Image stored as URL (external or local path)

### UI Features:
- ✅ Clean form with labels
- ✅ Preset unit combinations (flexible dropdowns)
- ✅ Live image preview from assets folder
- ✅ Success/error messages
- ✅ Mobile-responsive design

---

## Phase 3: 🚚 Loading Preparation (Lade-Übersicht)

**URL:** `loading.html`  
**User:** Warehouse staff (requires admin authentication)  
**Duration:** Morning preparation (30-60 minutes)  

### What Happens:
1. Warehouse staff logs in → `isAdmin = true` + `x-admin-key` header
2. View aggregate summary of all orders for TODAY
3. Sees per-customer totals:
   - Customer name
   - Total number of "units" (consolidation point)

### Data Flow:
```
GET /api/loading-summary
Headers: { "x-admin-key": "ich-liebe-naime" }

Response:
[
  { "customer_name": "Bakery A", "total_items": 15 },
  { "customer_name": "Restaurant B", "total_items": 8 }
]
```

### Backend Query:
```sql
SELECT c.name as customer_name, SUM(oi.quantity) as total_items
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN customers c ON o.customer_id = c.id
GROUP BY c.name
ORDER BY c.name;
```

### UI Features:
- ✅ Large, readable layout (18px+ fonts)
- ✅ Per-customer cards with totals
- ✅ Auto-refresh every 30 seconds
- ✅ Manual refresh button
- ✅ Timestamp showing last update

### Why Separate?
- Warehouse staff prepares physically while drivers use the next phase
- Real-time updates ensure accurate packing

---

## Phase 4: 📍 Delivery Tour (Fahrer-Tour)

**URL:** `tour.html`  
**User:** Delivery driver (requires admin authentication)  
**Duration:** Delivery day (3-4 hours)  

### What Happens:
1. Driver logs in → `isAdmin = true`
2. Views today's delivery route with all order items
3. For each item, marks status:
   - ⏳ Open (default)
   - ✅ Delivered
   - ❌ Refused
4. Real-time stats at top (items open/delivered/refused)

### Data Flow:
```
GET /api/delivery-tour
Headers: { "x-admin-key": "ich-liebe-naime" }

Response:
[
  {
    "id": 142,
    "customer_name": "Bakery A",
    "product_name": "Kartoffeln",
    "quantity": 10,
    "status": "open"
  }
]
```

### Update Status:
```
PATCH /api/update-status/142
Headers: { "x-admin-key": "ich-liebe-naime" }
Body: { "status": "delivered" }
```

### UI Features:
- ✅ Grouped by customer for route logic
- ✅ Large buttons for quick taps while driving
- ✅ Status badges (open/delivered/refused)
- ✅ Real-time stats showing progress
- ✅ Auto-refresh every 30 seconds
- ✅ Color-coded items (yellow=open, green=delivered, red=refused)

---

## Phase 5: 🔐 Entry Point (Scan)

**URL:** `scan.html`  
**User:** Anyone  

### What Happens:
1. User arrives at main page
2. See QR code for customer entry
3. OR admin can login with password

### Features:
- ✅ Beautiful gradient background
- ✅ QR code display (for mobile scanning)
- ✅ Admin login with password prompt
- ✅ Instructions for customers

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    ENTRY POINT (scan.html)              │
│        - QR Code for customers                          │
│        - Admin login with password                      │
└────────┬────────────────────────┬──────────────────────┘
         │                        │
    CUSTOMER FLOW            ADMIN FLOW
         │                        │
    ┌────▼────┐            ┌─────▼────┐
    │Phase 1  │            │Phase 2   │
    │Bestellung            │Admin     │
    │.html    │            │.html     │
    │         │            │          │
    │Customer │            │Add       │
    │enters   │            │Products  │
    │orders   │            │          │
    └────┬────┘            └──────────┘
         │
         │ Saved orders go to database
         │
    ┌────▼─────────────────┐
    │  DATABASE (orders)   │
    │  + order_items       │
    │  + products          │
    └────┬────────┬────────┘
         │        │
    WAREHOUSE    DELIVERY
    ┌────▼────┐  ┌──────▼───┐
    │Phase 3  │  │Phase 4   │
    │Loading  │  │Tour      │
    │.html    │  │.html     │
    │         │  │          │
    │Agg.     │  │Driver    │
    │summary  │  │confirms  │
    │for prep │  │delivery  │
    └─────────┘  └──────────┘
```

---

## State Machine: Order Lifecycle

```
┌──────────┐    customer    ┌──────────┐    delivery    ┌─────────────┐
│  EMPTY   │   places       │  OPEN    │   driver      │  DELIVERED  │
│ (Phase 1)├─────order──────▶(Phase 4) ├─────marks────▶| or REFUSED  │
└──────────┘                 │        │  (confirmed)   └─────────────┘
                             │        │
                             │        │
                        (Phase 3)    (visible real-time)
                        loads/preps
```

---

## Daily Workflow Example

### 9:00 AM - Start of Day
1. **Admin** (`index.html`) reviews dashboard
2. **Warehouse staff** opens `loading.html`
   - Sees today's customers & total items
   - Begins packing orders in warehouse

### 10:00 AM - Customers Order
1. **Customer** scans QR code → `bestellung.html?code=BAKERY01`
2. **Customer** selects:
   - 15 kg Kartoffeln
   - 2 Kisten Salat
3. **Order saved** to database

### 10:30 AM - Final Prep
1. **Warehouse staff** refreshes `loading.html`
   - Total items updated
   - Finishes packing all items
2. **Warehouse staff** calls driver

### 11:00 AM - Driver Tour
1. **Driver** logs in → `tour.html`
2. **Driver** sees all customers & items for today
3. **Driver** drives to each customer location
4. For each delivery:
   - ✅ If delivered → Click "Geliefert"
   - ❌ If refused → Click "Ablehnen"
5. **Stats update** in real-time

### 4:00 PM - End of Day
- All orders marked as delivered or refused
- Data persists in database for reporting

---

## Security Model

### Customer Access
- **Protected by:** `customerCode` in `localStorage`
- **Validation:** Customer code matches entry in `customers` table
- **Attack Surface:** Low (QR code per customer)

### Admin Access
- **Protected by:** `isAdmin` flag in `localStorage` + `x-admin-key` header
- **Header added to all admin requests:** `"x-admin-key": "ich-liebe-naime"`
- **Server validates:** Every admin endpoint checks this header
- **Current key:** `ich-liebe-naime` (⚠️ Should move to environment variable)

### Recommended: Environment Security
```
# .env file (never commit)
ADMIN_SECRET=ich-liebe-naime
DATABASE_URL=postgresql://...
PORT=3000
```

---

## Database Consistency

### Important:
- All phases read from the same database
- All writes go through backend validation
- No direct database access from frontend

### Key Tables:
- `customers` - Fixed, rarely changes
- `products` - Updated by admin
- `orders` - Created by customers
- `order_items` - Details of each order

---

## Troubleshooting: Phase Problems

| Problem | Phase | Cause | Fix |
|---------|-------|-------|-----|
| Customer can't order | Phase 1 | Invalid customer code | Verify code in `customers` table |
| Products won't load | Phase 1 | Database connection | Check `DATABASE_URL` |
| Admin can't add products | Phase 2 | Wrong `x-admin-key` | Verify key in header |
| Loading summary empty | Phase 3 | No orders for today | Check order `delivery_date` |
| Driver sees no items | Phase 4 | Query filter issue | Check date comparison in SQL |
| Status update fails | Phase 4 | Wrong `item_id` | Verify item exists in `order_items` |

---

## Performance Tips

### For High Volume:
1. **Lade-Übersicht** - Add pagination if >100 customers
2. **Fahrer-Tour** - Consider geolocation sorting
3. **Bestellung** - Cache product list client-side
4. **Admin** - Add product search feature

### Database Indexes (Recommended):
```sql
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_order_items_status ON order_items(status);
CREATE INDEX idx_customers_code ON customers(customer_code);
```

---

## Future Enhancements

- [ ] Real-time socket updates (WebSocket)
- [ ] GPS tracking for driver
- [ ] Route optimization algorithm
- [ ] Email/SMS confirmations
- [ ] Inventory management
- [ ] Historical reports
- [ ] Multi-language support
