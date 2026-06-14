# 📂 PROJECT_GUIDELINES: Logistik-Tool

Dieses Dokument beschreibt die Architektur und die Arbeitsabläufe für das Logistik-Tool.

## 1. Architektur-Prinzipien

* **Micro-Frontend-Ansatz:** Jede Phase (Bestellung, Admin, Tour, Lade-Übersicht) ist eine eigenständige `.html`-Datei.
* **Backend-Zentralisierung:** Alle Datenzugriffe laufen über das Node.js-API (`/api/...`).
* **Session-Management:** Die Kundenidentifikation erfolgt über `localStorage` (`customerCode`).
* **Sicherheit:** * Client-Seite: `localStorage` Check für Admin-Zugriff.
* Server-Seite: `adminOnly` Middleware für geschützte Routen.



## 2. Die 4 Phasen der App

1. **Bestellung (`bestellung.html`):** Kunde wählt Menge & Einheit -> Sendet `POST /api/orders`.
2. **Admin (`admin.html`):** Produkte verwalten -> `POST /api/products` (erfordert `x-admin-key`).
3. **Laden (`loading.html`):** Aggregiert Mengen pro Produkt & Einheit für die Einkaufsliste.
4. **Tour (`tour.html`):** Fahrer sieht Tour -> `PATCH /api/update-status` zum Setzen von "Geliefert/Abgelehnt".

## 3. Deployment & Workflow

* **Lokaler Start:** `npm run dev`
* **Cloud-Deployment:** Render.com (automatisch via GitHub-Push).
* **Datenbank:** Neon (PostgreSQL) – Verbindungsdaten via Umgebungsvariable `DATABASE_URL`.
* **Assets:** Bilder werden als URL gespeichert (z.B. Cloudinary oder externer Link).

## 4. Admin-Zugriff (Mobile-Login)

* **Login-Trick:** Falls du unterwegs bist, nutze `login.html` (setzt `isAdmin: true` im LocalStorage).
* **Abmeldung:** `logout()` Funktion führt zu `scan.html` (Anleitung zum Neu-Scannen).

## 5. Arbeitsanweisungen (Täglich)

1. **Morgens:** System auf Render/Server prüfen.
2. **Vor Ort:** QR-Code beim Kunden scannen (lädt `bestellung.html?code=XYZ`).
3. **Wartung:** Fehler oder Änderungen? `git push` -> Render baut neu -> Fertig.
4. **Daten-Hygiene:** Testdaten regelmäßig via SQL-Skript (`clear-test-data.sql`) bereinigen.
