# Implementation Plan - Breadcrumb Navigation Trail in Header

Add an interactive breadcrumb trail to the header component positioned as a clean sub-bar beneath the primary header row. The breadcrumb tracks user context (e.g., `Home > Customers > Acme Corp` or `Home > Operations`), supports clickable segment transitions, and adapts to a compact back-link trail on mobile viewports.

## User Review Required

> [!NOTE]
> - Positioning: Sub-bar directly beneath the main header row inside the sticky header container, maintaining seamless background blur and styling.
> - Navigation interaction: Clicking breadcrumb links smoothly transitions `activeTab` (and resets sub-entity selection where appropriate, e.g., clicking `Customers` returns from detail to the customer roster).
> - Production safeguards: No changes to Firestore rules, no alteration of authentication/OTP flow.

---

## Proposed Changes

### Header Component

#### [src/components/Header.tsx](file:///workspace/src/components/Header.tsx)
- Add breadcrumb configuration and hierarchy resolver based on `activeTab` and `selectedCustomer`:
  - Base: `Home` (navigates to `'dashboard'`)
  - Section: Friendly tab labels (`Dashboard`, `Driver Delivery Run`, `Operations Hub`, `Order Management`, `Customer Accounts`, `Inventory & Bottles`, `Team & Staff`, `Analytics & Reports`) with corresponding Lucide icons
  - Detail item (when applicable): `selectedCustomer.businessName` (clicking `Customer Accounts` clears the customer selection to return to the list)
- Render breadcrumb sub-bar as a secondary row below the main header row:
  - **Desktop view**: Full breadcrumb trail (`Home / Section / Detail`) with subtle separator icons (`ChevronRight`), hover highlights, and aria-label `Breadcrumb` with `aria-current="page"`.
  - **Mobile view**: Compact view displaying a return/back link with a left chevron to parent and current active page indicator.
- Support optional quick actions / reset if viewing sub-resources.

---

## Verification Plan

### Automated Verification
- Run `npm run lint` / `lint_applet` to check for syntax and type safety.
- Run `compile_applet` to ensure successful TypeScript build and Vite packaging.

### Manual Verification Steps
1. Navigate between tabs (Dashboard, Orders, Customers, Inventory, Analytics) and observe the breadcrumbs updating dynamically.
2. Select a customer and verify the trail extends to `Home > Customers > [Business Name]`.
3. Click the `Customers` breadcrumb link and verify it returns to the main customer list.
4. Click `Home` and confirm it switches to the Dashboard.
5. Resize screen to mobile view width (< 640px) to verify compact mobile layout.
