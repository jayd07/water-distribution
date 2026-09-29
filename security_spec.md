# Security Specification: AquaPure Springs Water Distribution

## 1. Data Invariants
1. A **Customer** record must have non-negative jar balance (`jarsHolding >= 0`), non-negative balance dues (`dueAmount >= 0`), and deposit paid (`depositPaid >= 0`).
2. An **InventoryItem** record must strictly track non-negative stock (`availableStock >= 0`, `borrowedStock >= 0`), with immutable item types.
3. A **DeliveryLog** record represents an immutable audit log of an atomic dispatch; once recorded, delivery records cannot be overwritten or deleted.
4. A **TransactionRecord** represents an immutable financial receipt of due clearances and refill payments; cannot be altered or deleted.
5. All operations under `/businesses/{businessId}/` must adhere to alphanumeric identifiers without path injection.

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Customer Creation**: Anonymous/unauthenticated client attempting write without authentication.
2. **Negative Jar Holding**: Payload with `jarsHolding: -5`.
3. **Negative Dues Amount**: Payload with `dueAmount: -100`.
4. **Arbitrary Key Injection (Ghost Fields)**: Payload injecting `{ isAdmin: true, role: 'SUPERUSER' }` into Customer record.
5. **Path Traversal / ID Poisoning**: Document ID containing directory traversal like `../../etc/passwd` or oversized 2KB strings.
6. **Delivery Record Mutation**: Attempting an `update` on an existing `/deliveries/{deliveryId}` document.
7. **Transaction Ledger Tampering**: Attempting an `update` on an existing `/transactions/{txId}` document to change amount.
8. **Invalid Customer Type**: Setting `customerType: "VIP_FREE_WATER"`.
9. **Invalid Payment Mode**: Setting `paymentMode: "BITCOIN"` in transaction or delivery.
10. **Negative Warehouse Stock**: Restock or transaction setting `availableStock: -50`.
11. **Shadow Update on Inventory**: Injecting unauthorized promo codes or bypass flags into inventory documents.
12. **Mismatched Document ID**: Creating a document where `incoming().id` does not match the `{customerId}` path.

## 3. Deployment Notes for Project `waterapp-eb5bf`
The rules in `firestore.rules` must be applied in the Firebase Console at:
https://console.firebase.google.com/project/waterapp-eb5bf/firestore/rules
