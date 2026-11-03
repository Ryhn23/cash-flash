# Next-Cash: Multi-Tenant Collaborative Financial & Expense Management System

> Production-grade collaborative ledger and expense management system inspired by the Safir Excel workflow (`BELANJA_SAFIR_diperbaiki.xlsx`). Built with strict solid-color visual hierarchy, zero-gradients design policy, stateful SQLite WAL architecture, automated anomaly detection, dual-direction calculation, and multi-layer RBAC.

---

## 1. Tech Stack & Architecture

- **Frontend**:
  - React 18+ & Vite with TypeScript
  - Tailwind CSS (Strict Zero-Gradients Design System)
  - Font Awesome 6 Free (`@fortawesome/fontawesome-free`) using `<i className="fa-solid fa-..." />` and `fa-regular` icons only (Zero Lucide dependency)
  - TanStack Table v8 (Spreadsheet-like ledger grid)
  - Recharts (Solid-color financial charts)
  - Framer Motion (Smooth micro-interactions and transitions)
  - TanStack Query v5 + Zustand (State & server sync)
- **Backend**:
  - Hono on Node.js runtime
  - TypeScript with strict Zod validation (`@hono/zod-validator`)
  - SQLite with `better-sqlite3` and Drizzle ORM (`PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`)
  - ExcelJS (Two-way Excel export & dry-run import with live formulas)
  - `@node-rs/argon2` (Argon2id password hashing)

---

## 2. Default Seed Accounts & Demo Workspace

The database is seeded with the **"BELANJA SAFIR"** workspace (`Rp 75.000.000` budget) and the following accounts:

| Role | Name | Email | Password | Scope |
|---|---|---|---|---|
| **`SUPER_ADMIN`** | Administrator Utama | `admin@nextcash.io` | `AdminPassword123!` | Global CRUD over all users, groups, and audit logs |
| **`GROUP_MANAGER`** | Fathir Bendahara | `bendahara@safir.org` | `SafirPassword123!` | Ketua / Bendahara Safir (Manages categories, budget, verifies duplicate flags) |
| **`EDITOR`** | Ahmad Pencatat | `staf@safir.org` | `SafirPassword123!` | Staf Pencatat (CRUD transactions, import/export, upload receipts) |

---

## 3. Core Financial Features

1. **Executive Dashboard (`Ringkasan`)**:
   - **6 KPI Cards**: Total Pengeluaran, Total Pemasukan/Pagu, Sisa Saldo (%), Total Transaksi, Status Rekonsiliasi, Counter Baris Perlu Dicek.
   - **Auto-Aggregated Category Breakdown**: Matches Excel Ringkasan logic with an automatic **"Belum dikategorikan"** bucket and percentage progress bars.
   - **Reconciliation Banner**: Automated check comparing the sum of all individual expense ledger rows against the category breakdown total (`OK - Sama` vs `Selisih`).
   - **Solid-Color Charts**: Horizontal Bar Chart for Category Spend, Daily Trend Line Chart, and Top Expense Items.
2. **Spreadsheet Ledger (`Belanja`)**:
   - Powered by **TanStack Table v8** with multi-field filtering (category, status, type, date range, search).
   - **Dual-Direction Calculation**:
     - *Mode A (Default)*: Input `Jumlah` & `Harga Satuan` &rarr; Auto-computes `Total Harga = Math.round(Jumlah * Harga Satuan)`.
     - *Mode B (Reverse Split)*: Input `Jumlah` & `Total Harga` &rarr; Auto-computes `Harga Satuan = Total Harga / Jumlah` (handles fractional unit prices like 3 units for Rp 178.480 while preserving exact integer Total Harga).
3. **Automated Anomaly & Duplicate Engine (`Cek Data`)**:
   - `DATA_BELUM_LENGKAP`: Missing date, description, category, quantity, or price.
   - `MUNGKIN_DOBEL`: Automatically triggered if another row in the same group shares the exact same `Tanggal` + normalized `Uraian` + `Total Harga` (mirrors Excel formula `COUNTIFS($A:$A, A5, $B:$B, B5, $G:$G, G5) > 1`).
   - `VERIFIED_DUPLICATE_OK`: A `GROUP_MANAGER` or `SUPER_ADMIN` can click "Konfirmasi Bukan Dobel" with a mandatory audit note to dismiss the flag.
4. **Two-Way Excel Integration (`.xlsx`)**:
   - **Export**: Generates `.xlsx` matching `BELANJA_SAFIR_diperbaiki.xlsx` with live formulas `ROUND(D*F,0)`, `COUNTIFS`, `SUMIFS`, and reconciliation status.
   - **Import**: Drag-and-drop parser with dry-run validation report (highlighting duplicates and incomplete rows before committing inside a single database transaction).
5. **Secure Receipt Upload**:
   - Files stored outside web root with randomized UUID filenames and MIME magic-byte validation (`PNG`, `JPEG`, `PDF`, `WEBP`).
6. **Activity Feed & Audit Trail**:
   - Row-level before/after JSON diffs tracking every creation, modification, and verification.

---

## 4. Production-Grade Security Architecture

1. **Authentication & Session Management**:
   - Argon2id password hashing with time cost 2 and 19MB memory.
   - Stateful session tokens stored as SHA-256 hashes in SQLite, delivered via `HttpOnly; SameSite=Lax; Path=/` cookies.
2. **Multi-Layer RBAC & IDOR / BOLA Prevention**:
   - `requireGroupAccess(minRole)` middleware verifies `(user.id, param.groupId)` on every group route.
   - Parameterized SQL queries strictly scoped with `WHERE id = :txId AND group_id = :verifiedGroupId`.
3. **XSS & Content Security Policy (CSP)**:
   - Strict CSP via `hono/secure-headers`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`.
   - HTML stripping on all inputs via Zod transforms.
4. **Spreadsheet Formula Injection (CSV/Excel Injection) Defense**:
   - Automatically sanitizes user text fields (`Uraian`, `Kategori`, `Catatan`) starting with `=`, `+`, `-`, `@`, `\t`, or `\r` by prefixing an apostrophe (`'`).
5. **CSRF & Rate Limiting**:
   - Double-submit / session-bound `X-CSRF-Token` header verification on all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Strict rate limiting on login (5 attempts / 15 min) and import (10 imports / hour) with 5MB payload limit.

---

## 5. Running the Application

```bash
# 1. Install dependencies
npm install

# 2. Seed database (SUPER_ADMIN, users, BELANJA SAFIR workspace with duplicate test cases)
npm run db:seed

# 3. Build frontend
npm run build

# 4. Start production server
npm start
# Server listens on http://localhost:3001
```

For development mode with hot-reloading:
```bash
# Run server watch and Vite dev server
npm run dev:server
npm run dev:client
```
