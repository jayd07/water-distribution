# Water Distributor — Release Notes & Patch Changelog

All notable changes, patches, and fallback baseline snapshots for **Water Distributor** will be documented in this file.

---

## [v1.0.0] - Production Live Release (2026-09-26)

### 🚀 Production Baseline Release
- **Enterprise Multi-Tenant Workspace**: Isolated Firestore database synchronization per registered business workspace.
- **Role-Based Access Control (RBAC)**: Support for Business Owner, Manager, Dispatcher, and Delivery Driver profiles.
- **Atomic Delivery Logistics**: Real-time concurrent jar stock decrementing, empties restoration, and customer bottle float ledger updates with zero race conditions.
- **Dynamic Bharat UPI Payments**:
  - Scan-to-pay QR codes generated on tax invoices, delivery receipts, and pending balance clearance dialogs.
  - Live on-screen doorstep QR code generation inside `NewDeliveryModal` for instant customer payment at delivery.
- **Automated WhatsApp Payment Reminders**:
  - Overdue balance assistant with 1-click WhatsApp messaging.
  - Dynamic UPI payment deep links (`upi://pay?...`) embedded directly in reminder templates.
- **Accounting & Day Book Synchronization**:
  - Unified Day Book CSV generator formatted for Tally ERP, QuickBooks, and Zoho Books.
  - 1-click **Google Sheets TSV Copy** for direct copy-pasting (`Ctrl+V`) into blank spreadsheets (`sheets.new`).
- **Offline PWA & Network Resilience**: Service worker caching, IndexedDB local persistence, and background long-polling for poor signal areas.
- **Fault-Tolerant Fallback System**:
  - `AppErrorBoundary` wrapping the application with automated crash interception.
  - 1-click **Fallback to Stable v1 Baseline** with cache purging and emergency JSON state export.
  - Patch release history tracker modal accessible from the `v1.0` header badge.

---

### 🛡️ How to Deploy Future Patches
1. Apply the bug fix or feature enhancement in the codebase.
2. Increment the patch version (e.g. `v1.0.1`) and add a record to `PATCH_HISTORY` in `src/config/version.ts`.
3. Run `npm run build`. The automated post-build pipeline generates cache-busting fingerprints and updates `version.json`.
4. If an unexpected error occurs in a deployed patch, the built-in **ErrorBoundary & Fallback Engine** allows users to rollback instantly to the stable v1.0.0 baseline with zero data loss.
