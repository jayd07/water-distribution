# AquaPure Springs — Enterprise Architecture Document
**System Design Specification: High-Level Design (HLD) & Low-Level Design (LLD)**

---

## Document Information
* **Project Name**: AquaPure Springs (Packaged Water Distribution & Bottle Management ERP)
* **Document Type**: Architecture & Engineering Specification (HLD + LLD)
* **Version**: 2.4.0 (Production Release)
* **Target Audience**: Software Engineers, Architects, System Administrators, Product Managers
* **Author / Owner**: Lead Systems Architect

---

## Table of Contents
1. [Executive Overview & Business Objectives](#1-executive-overview--business-objectives)
2. [High-Level Design (HLD)](#2-high-level-design-hld)
   * 2.1 [System Architecture & Network Topology](#21-system-architecture--network-topology)
   * 2.2 [Core Subsystems & Component Responsibilities](#22-core-subsystems--component-responsibilities)
   * 2.3 [Multi-Tenant Data Isolation & RBAC Hierarchy](#23-multi-tenant-data-isolation--rbac-hierarchy)
   * 2.4 [Cloud Infrastructure & Real-Time Sync Strategy](#24-cloud-infrastructure--real-time-sync-strategy)
   * 2.5 [Security, Authentication & Session Lifecycle](#25-security-authentication--session-lifecycle)
   * 2.6 [Non-Functional Requirements & SLAs](#26-non-functional-requirements--slas)
3. [Low-Level Design (LLD)](#3-low-level-design-lld)
   * 3.1 [Data Models & TypeScript Interface Specifications](#31-data-models--typescript-interface-specifications)
   * 3.2 [Firestore Collection & Subcollection Hierarchy](#32-firestore-collection--subcollection-hierarchy)
   * 3.3 [Core Business Services & Ledger Engine](#33-core-business-services--ledger-engine)
   * 3.4 [UPI Protocol, QR Encoding & Payment Intent Engine](#34-upi-protocol-qr-encoding--payment-intent-engine)
   * 3.5 [UI Component Hierarchy & Reactive State Flow](#35-ui-component-hierarchy--reactive-state-flow)
   * 3.6 [Detailed Sequence Diagrams](#36-detailed-sequence-diagrams)
   * 3.7 [Offline Resilience, Error Handling & Recovery Matrix](#37-offline-resilience-error-handling--recovery-matrix)
4. [Deployment & Operations](#4-deployment--operations)

---

# 1. Executive Overview & Business Objectives

**AquaPure Springs** is a high-performance, mobile-first, cloud-synchronized Progressive Web Application (PWA) engineered specifically for commercial 20-liter packaged drinking water plants, distributors, and delivery fleets.

### Core Business Problems Solved
1. **Empty Jar Leakage**: Track continuous jar balances held by each residential and corporate customer to eliminate unreturned bottle asset losses.
2. **Field Due Collection**: Field delivery drivers can instantly generate NPCI-standard dynamic UPI QR codes and record on-the-spot settlements without third-party payment gateway transaction fees.
3. **Multi-Role Separation (RBAC)**: Distinct, secure interfaces for Business Owners (full inventory, analytics, tax invoicing, staff management) and Delivery Staff (streamlined route views, quick drop/return buttons, UPI QR codes, zero access to sensitive accounting or deletion controls).
4. **Offline Resilience**: Full functional continuity when delivering in basement parking lots or rural routes with degraded mobile coverage, with seamless auto-reconciliation upon reconnection.

---

# 2. High-Level Design (HLD)

## 2.1 System Architecture & Network Topology

```
+-----------------------------------------------------------------------------------+
|                                CLIENT RUNTIME                                     |
|                       (PWA / Desktop & Mobile Browser)                            |
+-----------------------------------------------------------------------------------+
       |                                                                     |
       v                                                                     v
+------------------------------------+             +------------------------------------+
|         OWNER / ADMIN UI           |             |         WORKER / DRIVER UI         |
|  * Plant Analytics & Day Book      |             |  * Route Customer List             |
|  * Warehouse Restock & Stock Mgmt  |             |  * Quick Dispatch (Drop / Return)  |
|  * Formal GST Tax Invoices         |             |  * Due Settlement & Live UPI QR    |
|  * Staff & Driver Provisioning     |             |  * Mobile Floating Quick Action    |
+------------------------------------+             +------------------------------------+
       \                                                                     /
        \---------------------------------+---------------------------------/
                                          |
                                          v
                    +-------------------------------------------+
                    |           REACT STATE & HOOKS             |
                    |  * Role & Multi-Tenant Session Context    |
                    |  * Write-Through Memory/Local Store Cache |
                    |  * Live Firestore Snapshot Subscriptions  |
                    +-------------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
        v                                 v                                 v
+-------------------------------+ +-------------------------------+ +-------------------------------+
|    FIREBASE AUTHENTICATION    | |      CLOUD FIRESTORE DB       | |       EXTERNAL PROTOCOLS      |
|  * Phone OTP (reCAPTCHA v3)   | |  * Multi-Tenant Root & Subs   | |  * NPCI UPI 2.0 (upi://pay)   |
|  * Google OAuth Client Flow   | |  * Document CRUD & Aggregates | |  * Google Sheets Webhook API  |
|  * Token & Session Validation | |  * CollectionGroup Discovery  | |  * WhatsApp Universal Links   |
+-------------------------------+ +-------------------------------+ +-------------------------------+
```

---

## 2.2 Core Subsystems & Component Responsibilities

| Subsystem | Responsibilities | Target Actors |
| :--- | :--- | :--- |
| **Authentication & Multi-Tenant Discovery** | Phone OTP verification, Google authentication, auto-discovery of employer businesses via indexed phone mappings, session initialization, and clean teardown. | All Users |
| **Dispatch & Bottle Balance Engine** | Atomic calculation of customer empty jar deficits, warehouse full/empty jar transitions, and delivery log generation. | Drivers, Owners |
| **Payment & NPCI UPI Subsystem** | Dynamic NPCI UPI 2.0 URI encoding, live high-resolution QR rendering, one-click app deep-links (GPay, PhonePe, Paytm, BHIM), and payment logging. | Drivers, Customers |
| **Warehouse & Inventory Subsystem** | Multi-SKU stock tracking (20L Normal Cans, 20L Chilled Cans, 1L Cases, Dispenser Coolers), restock batch logging, and inventory valuation. | Plant Managers, Owners |
| **Tax Invoicing & Accounting Engine** | Formal GST-compliant invoice generation, WhatsApp payment reminder and ledger sharing, and automated Google Sheets Day Book synchronization. | Business Owners |
| **Sync & Cache Management** | Live bidirectional Firestore snapshot synchronization, write-through `localStorage` caching, and service worker update pipelines. | All Clients |

---

## 2.3 Multi-Tenant Data Isolation & RBAC Hierarchy

### Tenant Partitioning
All enterprise data is isolated by `businessId`. Top-level business configurations reside in `/businesses/{businessId}`, with all customer accounts, deliveries, inventory records, transactions, orders, and staff records residing inside dedicated subcollections.

```
/businesses/{businessId}/
   ├── customers/
   ├── inventory/
   ├── deliveries/
   ├── transactions/
   ├── orders/
   └── workers/
```

### RBAC Permission Matrix

| Operation / Feature | Owner (`OWNER`) | Driver / Worker (`WORKER`) | Anonymous / Logged Out |
| :--- | :---: | :---: | :---: |
| Register New Business | ✅ | ❌ | ❌ |
| Delete Business & Subcollections | ✅ | ❌ | ❌ |
| Manage Staff & Assign Routes | ✅ | ❌ | ❌ |
| Warehouse Restock & SKU Rates | ✅ | ❌ | ❌ |
| Google Sheets Export & Day Book | ✅ | ❌ | ❌ |
| Generate Formal GST Invoices | ✅ | ❌ | ❌ |
| Send WhatsApp Reminders & Bills | ✅ | ❌ | ❌ |
| Quick Delivery (Drop Cans) | ✅ | ✅ | ❌ |
| Quick Jar Return (Collect Empties) | ✅ | ✅ | ❌ |
| Settle Due & Show Live UPI QR | ✅ | ✅ | ❌ |
| View Assigned Customer Route | ✅ | ✅ | ❌ |

---

## 2.4 Cloud Infrastructure & Real-Time Sync Strategy
* **Database**: Cloud Firestore in `asia-east1` with multi-region backup.
* **Sync Strategy**: 
  * Active listeners (`onSnapshot`) subscribe to open business subcollections.
  * Writes execute optimistically against memory and `localStorage` before writing to Firestore, delivering sub-50ms UI feedback for field workers.
* **Network Throttling Handling**: Firestore offline persistence handles intermittent packet loss on rural delivery routes.

---

## 2.5 Security, Authentication & Session Lifecycle
* **Authentication**: Firebase Authentication supporting Phone OTP (with reCAPTCHA validation) and Google OAuth.
* **Session Storage**: Active user profile stored in `aquapure_active_session_v1`.
* **Zero-Leakage Logout**: On logout, Firebase authentication session is terminated, local and session storage keys are removed, and the UI resets immediately to `DEFAULT_BUSINESS` (initial registration/home view) with no residual state.

---

## 2.6 Non-Functional Requirements & SLAs

* **Response Latency**: Core UI actions (Drop, Return, Settle Due) execute in $< 50\text{ ms}$; Firestore cloud synchronization completes in $< 500\text{ ms}$ under standard 4G connectivity.
* **Zero Payment Gateway Fee**: Direct peer-to-merchant NPCI UPI protocol implementation incurs 0% transaction costs.
* **PWA Reliability**: Full offline caching via Workbox service worker enables core route navigation and dispatch logging when network drops.

---

# 3. Low-Level Design (LLD)

## 3.1 Data Models & TypeScript Interface Specifications

### 3.1.1 Business Account Model (`src/types.ts`)
```typescript
export interface BusinessAccount {
  id: string;                      // Unique identifier: biz_{slug}_{timestamp}
  name: string;                    // Registered Business Name
  ownerName: string;               // Full name of legal proprietor
  ownerPhone: string;              // 10-digit normalized phone number
  ownerEmail?: string;             // Owner Google account email
  ownerUid?: string;               // Firebase Authentication UID
  category?: string;               // Industry sector classification
  address?: string;                // Plant / Warehouse street address
  city?: string;                   // Operating municipal hub
  gstin?: string;                  // 15-character GST registration number
  upiId?: string;                  // Official NPCI UPI VPA (e.g. 9876543210@upi)
  googleSheetsWebhookUrl?: string; // Webhook endpoint for live Day Book export
  googleSheetsUrl?: string;        // Destination Google Spreadsheet URL
  defaultJarRate?: number;         // Default price per 20L can (INR)
  createdAt: number;               // Epoch millisecond timestamp
  updatedAt?: number;              // Last modification timestamp
  workerPhones?: string[];         // Normalized phone numbers of authorized staff
  workers?: BusinessWorker[];      // Staff registry
}
```

### 3.1.2 Customer Model (`src/types.ts`)
```typescript
export interface Customer {
  id: string;                      // cust_{timestamp}_{random}
  businessId: string;              // Parent business foreign key
  name: string;                    // Customer / Business entity name
  phone: string;                   // Contact phone number
  address: string;                 // Delivery address & flat/floor details
  route: string;                   // Assigned route sector (e.g., "Sector 62")
  depositAmount: number;           // Security deposit held for jars/coolers (₹)
  jarsHolding: number;             // Count of empty 20L jars currently held
  dueAmount: number;               // Outstanding credit balance (₹)
  pricePerJar: number;             // Negotiated price per jar for this customer
  activeCoolers: number;           // Count of dispenser machines placed
  createdAt: number;
  updatedAt: number;
}
```

### 3.1.3 Delivery Log Model (`src/types.ts`)
```typescript
export interface DeliveryLog {
  id: string;                      // deliv_{timestamp}_{random}
  businessId: string;
  customerId: string;
  customerName: string;
  jarsDelivered: number;           // Count of filled 20L jars supplied
  jarsReturned: number;            // Count of empty 20L jars collected
  ratePerJar: number;              // Unit price billed
  totalAmount: number;             // jarsDelivered * ratePerJar
  paymentMode: 'CASH' | 'ONLINE' | 'UPI' | 'CREDIT';
  amountCollected: number;         // Cash/UPI received at time of drop
  pendingAmount: number;           // Amount added to customer's due ledger
  deliveryDate: string;            // Standard format: YYYY-MM-DD
  timestamp: number;
  route?: string;
  deliveryBoy?: string;            // Name of driver who executed delivery
}
```

### 3.1.4 Transaction Record Model (`src/types.ts`)
```typescript
export interface TransactionRecord {
  id: string;                      // tx_{timestamp}_{random}
  businessId: string;
  customerId: string;
  customerName: string;
  amount: number;                  // Payment amount (₹)
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  timestamp: number;
  date: string;                    // YYYY-MM-DD
  note?: string;                   // Audit note (e.g., "Settled via GPay")
}
```

### 3.1.5 User Session Model (`src/types.ts`)
```typescript
export interface UserSessionProfile {
  phoneNumber: string;             // Authenticated user's phone number
  displayName: string;             // User display name
  activeBusinessId: string;        // ID of selected tenant business
  role: 'OWNER' | 'WORKER';        // Enforced access role
  workerRecord?: BusinessWorker;   // Worker metadata if in WORKER role
}
```

---

## 3.2 Firestore Collection & Subcollection Hierarchy

```
businesses/                                    [Collection: Root Business Accounts]
  └── {businessId}/                            [Document: Business Metadata & Config]
        ├── customers/                         [Subcollection: Customer Profiles]
        │     └── {customerId}                 (name, phone, jarsHolding, dueAmount)
        ├── inventory/                         [Subcollection: Warehouse Stock Items]
        │     └── {itemId}                     (itemType, availableStock, emptyCans)
        ├── deliveries/                        [Subcollection: Dispatch Audit Logs]
        │     └── {deliveryId}                 (jarsDelivered, jarsReturned, amount)
        ├── transactions/                      [Subcollection: Financial Payments]
        │     └── {transactionId}              (amount, paymentMode, timestamp)
        ├── orders/                            [Subcollection: Advance Bookings]
        │     └── {orderId}                    (deliveryDate, jarsRequested, status)
        └── workers/                           [Subcollection: Staff Registry]
              └── {workerId}                   (workerName, workerPhone, role)

worker_assignments/                            [Top-Level Indexed Collection for Discovery]
  └── {workerPhone}_{businessId}               (Quick index for driver cross-login)
```

---

## 3.3 Core Business Services & Ledger Engine

### 3.3.1 Dispatch Transaction Pipeline (`src/services/deliveryService.ts`)
When a delivery is recorded (`recordDelivery`):
1. **Customer Ledger Update**:
   $$\Delta \text{Jars} = \text{jarsDelivered} - \text{jarsReturned}$$
   $$\text{newJarsHolding} = \max(0, \text{customer.jarsHolding} + \Delta \text{Jars})$$
   $$\text{newDueAmount} = \max(0, \text{customer.dueAmount} + (\text{totalAmount} - \text{amountCollected}))$$
2. **Warehouse Stock Adjustment**:
   $$\text{availableStock} = \max(0, \text{item.availableStock} - \text{jarsDelivered})$$
   $$\text{emptyStock} = \text{item.emptyStock} + \text{jarsReturned}$$
3. **Audit Trails**: Atomically creates a `DeliveryLog` and (if payment was collected) a matching `TransactionRecord`.

---

## 3.4 UPI Protocol, QR Encoding & Payment Intent Engine

### 3.4.1 NPCI URI Constructor (`src/utils/upiUtils.ts`)
```typescript
export function generateUpiUri(params: {
  upiId: string;
  merchantName: string;
  amount: number;
  note: string;
}): string {
  const query = new URLSearchParams({
    pa: params.upiId,               // Payee Virtual Payment Address (VPA)
    pn: params.merchantName,        // Payee Registered Name
    am: params.amount.toFixed(2),   // Amount with 2 decimal precision
    cu: 'INR',                      // Currency Code (Indian Rupee)
    tn: params.note                 // Transaction Note
  });
  return `upi://pay?${query.toString()}`;
}
```

### 3.4.2 VPA Resolution Hierarchy (`src/components/SettleDueModal.tsx`)
1. **Primary**: Business configured `upiId` from business profile.
2. **Secondary**: Formatted owner phone number (`${ownerPhone.slice(-10)}@upi`).
3. **Tertiary**: Indexed business record lookup via local store cache.

---

## 3.5 UI Component Hierarchy & Reactive State Flow

```
App (Root Component)
  ├── Header (Brand Logo, Global Search, Role Indicator, Profile & Logout Menu)
  ├── Main Viewport (Conditional on Active Role & Tab)
  │     ├── [When Not Registered]: Initial Landing (Register / Sign-In CTAs)
  │     ├── [When Owner Role]:
  │     │     ├── DashboardPage (KPI Cards, Fast Dispatch, Recent Audit Feed)
  │     │     ├── CustomerManagement (Customer Ledger, WhatsApp Billing, GST Invoices)
  │     │     ├── WarehouseView (SKU Stocks, Full/Empty Tally, Restock Batches)
  │     │     ├── OrdersManagement (Advance Bookings, Rental Placements)
  │     │     ├── TeamManagement (Staff Add/Remove, Route Assignments)
  │     │     └── AnalyticsPage (Revenue Trends, Route Bottle Heatmaps)
  │     └── [When Worker Role]:
  │           └── CustomerManagement (Route View, Quick Drop, Quick Return, Settle Due)
  ├── MobileBottomNav (Fixed Bottom Bar: Customers, Floating Dispatch, Switch Biz, Logout)
  └── Modal Dialog Subsystem
        ├── SettleDueModal (Live UPI QR Standee, Deep-Link, Cash/Bank Settlement)
        ├── NewDeliveryModal (Full Dispatch Dialog with SKU Selection)
        ├── GPayBusinessModal (Phone OTP Login, Multi-Business Selector, Profile Edit)
        ├── RestockModal (Warehouse Stock Batch Addition)
        ├── InvoiceModal (Printable GST Tax Invoice & Ledger Sheet)
        └── ExportAccountingModal (Google Sheets Day Book Webhook Exporter)
```

---

## 3.6 Detailed Sequence Diagrams

### 3.6.1 Delivery Dispatch & Bottle Balance Reconciliation
```
Worker / Driver            CustomerManagement           deliveryService             Firestore Subcollections
      |                             |                          |                                 |
      |-- Click "Drop" (Quick Refill)|                          |                                 |
      |---------------------------->|-- recordQuickDelivery -->|                                 |
      |                             |                          |-- 1. Fetch Customer Record ---->|
      |                             |                          |<-- Current Jars & Due Balance --|
      |                             |                          |                                 |
      |                             |                          |-- 2. Update Customer Doc ------>|
      |                             |                          |      (jarsHolding + 1, due+35)  |
      |                             |                          |                                 |
      |                             |                          |-- 3. Adjust Inventory Doc ----->|
      |                             |                          |      (available - 1)            |
      |                             |                          |                                 |
      |                             |                          |-- 4. Append DeliveryLog ------->|
      |                             |                          |                                 |
      |<-- Toast: "1 Jar Delivered"-|<-- Local Store Updated --|<-- Firestore Write Ack --------|
```

### 3.6.2 UPI Settlement & Dynamic QR Workflow
```
Customer / Driver                 SettleDueModal                   upiUtils                 deliveryService
      |                                  |                            |                            |
      |-- Click "Due" / "Txn" Button --->|                            |                            |
      |                                  |-- Derive Business UPI ID ->|                            |
      |                                  |-- generateUpiUri() ------->|                            |
      |                                  |<-- upi://pay URI ----------|                            |
      |                                  |                                                         |
      |                                  |-- generateUpiQrDataUrl() -> (QRCode Engine)             |
      |                                  |<-- Base64 QR Image Data Url ----------------------------|
      |                                  |                                                         |
      |<-- Render Standee with Live QR --|                                                         |
      |    & Deep-Link App Button        |                                                         |
      |                                  |                                                         |
      |-- Scan & Pay ₹35 via PhonePe --->|                                                         |
      |-- Click "Record Payment" ------->|-- recordDueSettlement() ------------------------------->|
      |                                  |                                                         |-- Write Tx Log & Reset Due -> Firestore
      |<-- Due Cleared (₹0 Pending) -----|<-- Success Event ---------------------------------------|
```

### 3.6.3 Secure Logout & Session Teardown
```
User (Owner/Worker)               Header / Mobile Nav              App Component             Storage / Firebase Auth
      |                                    |                             |                               |
      |-- Click "Logout" ----------------->|-- onSignOut() ------------->|                               |
      |                                    |                             |-- signOutUser() ------------->| (Firebase Auth)
      |                                    |                             |-- clearActiveSession() ------>| (localStorage &
      |                                    |                             |                               |  sessionStorage)
      |                                    |                             |                               |
      |                                    |                             |-- Reset React State:          |
      |                                    |                             |   * currentBusiness = DEFAULT |
      |                                    |                             |   * userSession = null        |
      |                                    |                             |   * all collections = []      |
      |                                    |                             |   * close all open modals     |
      |                                    |                             |                               |
      |<-- Initial Home View Rendered -----|<----------------------------|<-- isBusinessRegistered = false
           ("No Business Registered Yet", "Register Now", "Sign In")
```

---

## 3.7 Offline Resilience, Error Handling & Recovery Matrix

| Failure Event | Detection Mechanism | System Handling & Auto-Recovery |
| :--- | :--- | :--- |
| **Field Internet Drop** | `navigator.onLine == false` or Firestore write failure | Operations write to local store (`localStorage.getItem('aquapure_data_{bizId}')`); UI updates immediately. Changes queue and sync automatically upon network reconnection. |
| **Missing Business UPI ID** | Empty `business.upiId` string | Falls back dynamically to `${business.ownerPhone.slice(-10)}@upi` to guarantee live QR display. |
| **Worker Permission Violation** | Role assertion check | Worker UI excludes administrative tabs (Warehouse Restock, Delete Business, Team Management, Invoices). Firestore rules reject non-owner mutations. |
| **Stale Cache on Deployment** | Deployment cache hash comparator | `useDeploymentCache` triggers automated background cache clearing and service worker updates with zero manual user intervention. |

---

# 4. Deployment & Operations

* **Build Target**: Vite SPA (React 18 + TypeScript) with `@tailwindcss/vite`.
* **Runtime**: Production Node.js server mounting Vite middlewares (`npm run build && npm start`).
* **Environment Configuration**: Variables managed via `.env` / environment secrets.

---

*Document compiled and verified for production release.*
