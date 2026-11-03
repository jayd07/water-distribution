# Product Requirements Document (PRD)
## UI & Component Design System for Google Stitch
### Project: AquaPure Springs – Water Distribution & Bottle Tracking Management System
**Document Version:** 1.0.0  
**Target Platform:** Google Stitch (AI UI Generation, Design Tokens & Component Prototyping)  
**Status:** Ready for Stitch Import / Design Generation  

---

## 1. Executive Summary & Purpose

### 1.1 Objective
This Product Requirements Document (PRD) defines the full visual architecture, layout specifications, component tokens, responsive interaction states, and AI generation prompts to create and prototype the complete user interface for **AquaPure Springs** inside **Google Stitch**.

### 1.2 System Overview
AquaPure Springs is a high-velocity operations and route dispatch platform for commercial and residential packaged water distribution businesses. The platform manages:
- **Circulating Asset Tracking**: Real-time tracking of circulating 20L polycarbonate water jars and electric coolers.
- **Route & Driver Dispatch**: On-the-go logging of deliveries, empty bottle collection, and instant payment settlement.
- **Customer CRM & Ledger**: Real-time outstanding balances, bottle deposits, and delivery route ordering.
- **Daily Accounting & Day Book**: Cash vs. UPI collections, daily sales summaries, PDF/Excel export, and direct 1-tap WhatsApp statement sharing.
- **Bilingual & Field-Resilient**: Seamless English and Gujarati language support, high-contrast outdoor mobile visibility, and offline PWA resilience.

---

## 2. Target Personas & Viewport Strategies

| Persona | Environment & Device | Primary Objectives | Key UI Constraints |
| :--- | :--- | :--- | :--- |
| **Delivery Driver / Route Staff** | Smartphone (390 × 844 px), handheld in delivery van | Log deliveries in under 5 seconds, count empty bottles, tap-to-call, collect UPI/Cash | 48px+ touch targets, single-thumb ergonomics, glare-resistant contrast, high readability |
| **Plant & Hub Dispatch Manager** | Tablet / Laptop (1024 × 768 to 1440 × 900 px) | Monitor live vehicle stock, assign routes, manage inventory shrinkage, reconcile cash | Dense data tables, quick status badges, batch actions, search modal (`Cmd+K`) |
| **Business Owner / Accountant** | Desktop / Tablet (1280 × 800+ px) | Review daily revenue, monitor customer dues, export day books, audit analytics | Clean KPI cards, Recharts visualizations, 1-click WhatsApp PDF sharing |

---

## 3. Stitch Design System & Token Specifications

### 3.1 Color Palette Tokens

```css
/* Core Brand & Semantic Tokens */
--color-brand-primary: #0284c7;        /* Sky 600 - Main headers, primary buttons, accents */
--color-brand-primary-hover: #0369a1;  /* Sky 700 - Active hover states */
--color-brand-primary-light: #e0f2fe;  /* Sky 100 - Active tab pills, soft icon backgrounds */
--color-brand-accent: #0ea5e9;         /* Sky 500 - Interactive highlights, gauges */

/* Status & Financial Tokens */
--color-success-bg: #ecfdf5;           /* Emerald 50 */
--color-success-text: #059669;         /* Emerald 600 - Cash collected, stock safe */
--color-success-border: #a7f3d0;       /* Emerald 200 */

--color-warning-bg: #fffbeb;           /* Amber 50 */
--color-warning-text: #d97706;         /* Amber 600 - Low stock, pending orders */
--color-warning-border: #fde68a;       /* Amber 200 */

--color-danger-bg: #fef2f2;            /* Red 50 */
--color-danger-text: #dc2626;          /* Red 600 - High dues, missing bottles */
--color-danger-border: #fecaca;        /* Red 200 */

--color-upi-badge: #7c3aed;            /* Purple 600 - Digital UPI payment badge */
--color-upi-bg: #f5f3ff;               /* Purple 50 */

/* Neutrals & Surfaces */
--color-surface-bg: #f8fafc;           /* Slate 50 - Global app canvas */
--color-surface-card: #ffffff;         /* White - Elevated cards and modal surfaces */
--color-border-subtle: #e2e8f0;        /* Slate 200 - Card borders, dividers */
--color-text-primary: #0f172a;         /* Slate 900 - Headings, high emphasis text */
--color-text-secondary: #475569;       /* Slate 600 - Labels, table data, subheadings */
--color-text-muted: #94a3b8;           /* Slate 400 - Placeholders, timestamp metadata */
```

### 3.2 Typography Tokens

- **Font Family**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Gujarati Localization Font**: "Noto Sans Gujarati", Inter, sans-serif.
- **Scale**:
  - `Display / Hero`: 28px (1.75rem), SemiBold (600), Line-height 1.2
  - `Heading 1`: 22px (1.375rem), SemiBold (600), Line-height 1.25
  - `Heading 2`: 18px (1.125rem), Medium (500), Line-height 1.3
  - `Body Regular`: 14px (0.875rem), Normal (400), Line-height 1.5
  - `Body Medium / Button`: 14px (0.875rem), SemiBold (600), Line-height 1.4
  - `Caption / Badge`: 12px (0.75rem), Medium (500), Line-height 1.3
  - `Monospace Currency`: Tabular numbers (`font-variant-numeric: tabular-nums`) for currency (₹) and jar counts.

### 3.3 Elevation & Shape Tokens

- **Border Radius**:
  - Small elements (Tags, badges, inputs): `rounded-lg` (8px)
  - Cards, tables, dropdowns: `rounded-xl` (12px)
  - Modals, large feature containers: `rounded-2xl` (16px)
  - Floating action buttons, avatars: `rounded-full` (9999px)
- **Shadows**:
  - Level 1 (Card default): `0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)`
  - Level 2 (Hover / Active popover): `0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)`
  - Level 3 (Modal / Bottom Sheet): `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`

---

## 4. Global Navigation & Layout Architecture

### 4.1 Shell Wireframe Layout

```
+------------------------------------------------------------------------------------------------------+
| [AquaPure Logo] | Global Search (Cmd+K) | [EN/GU Toggle] [Cloud Sync Status] [Business Profile v]    |
+------------------------------------------------------------------------------------------------------+
| Breadcrumbs: Home > Dashboard > Today's Operations                     [+ Record Delivery] [Export]  |
+------------------------------------------------------------------------------------------------------+
| [Nav Tabs]: [Overview] [Driver Run] [Operations] [Orders] [Customers] [Inventory] [Team] [Analytics]|
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  MAIN CONTENT VIEWPORT (Responsive Container max-w-7xl)                                             |
|                                                                                                      |
|  [ Today's Performance Summary Block: Total Deliveries | Jars Delivered | Day's Revenue ]            |
|                                                                                                      |
|  +-------------------------------------+  +-------------------------------------------------------+  |
|  | KPI Grid (4 Metrics Cards)          |  | Live Warehouse & In-Transit Jar Gauge                 |  |
|  +-------------------------------------+  +-------------------------------------------------------+  |
|                                                                                                      |
|  +------------------------------------------------------------------------------------------------+  |
|  | Dynamic Tab Content (Deliveries Table / Customer Grid / Inventory Ledger / Analytics Charts)   |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
+------------------------------------------------------------------------------------------------------+
| (Mobile Viewport Only) Sticky Bottom Nav: [Home] [Run Sheet] [Deliver +] [Customers] [Account]       |
+------------------------------------------------------------------------------------------------------+
```

### 4.2 Header & Breadcrumb Trail Sub-Bar
- **Primary Header Row**:
  - Left: AquaPure drop icon + Brand Name + Business Switcher.
  - Center: Global Omnibar search (keyboard shortcut `⌘K` / `Ctrl+K`).
  - Right: Gujarati/English pill toggle, online/offline sync status badge with pulsing green/amber dot, notifications bell, and avatar menu.
- **Secondary Breadcrumb Sub-Bar**:
  - Desktop: Displays structured path with clickable breadcrumb pills (e.g., `Home` > `Operations` > `Delivery Day Book`).
  - Mobile: Compact view showing a `< Back` button with current active view title to maximize vertical screen space.

---

## 5. Detailed Screen & Component Specifications for Google Stitch

### 5.1 Screen 1: Dashboard & Live Operations

#### A. Today's Performance Summary Block
- **Placement**: Top of main dashboard content area (`#dashboard-todays-performance-block`).
- **Layout**: Header with live status pill + 3-card horizontal grid (stacks on mobile).
- **Sub-Components**:
  1. **Total Deliveries Card**:
     - Metric: Count of logged delivery transactions today (e.g., `42 Trips`).
     - Subtitle: "Customer stops served today".
     - Icon: `Truck` or `CheckCircle2` in sky blue tint.
  2. **Jars Delivered Card**:
     - Metric: Total filled jars dispatched (e.g., `85 Jars`).
     - Subtitle: "Empty bottles collected: 78".
     - Icon: `Activity` or `Droplets` in cyan tint.
  3. **Current Day's Revenue Card**:
     - Metric: Formatted total collection (e.g., `₹5,950`).
     - Subtitle: Dynamic pill breakdown (`Cash: ₹3,800` | `UPI: ₹2,150`).
     - Icon: `IndianRupee` in emerald green tint.
  4. **Integrated Quick Actions**:
     - Primary button: `+ Record Delivery` (Sky 600 button with white icon).
     - Secondary button: `Export Day Book` (Outline button triggering Export Accounting modal).

#### B. KPI Metrics Row (4 Cards)
- **Stock Available**: Warehouse ready 20L jars (`410 / 500 Capacity`).
- **Jars in Market**: Circulating with customers (`820 Active`).
- **Pending Payments**: Total overdue balance across all customers (`₹18,450`).
- **Active Orders**: Pre-bookings and water cooler dispenser rentals (`7 Scheduled`).

#### C. Inventory Gauge Component
- Visual gauge / progress bar showing:
  - Full Jars in Plant (Green)
  - Full Jars in Delivery Vans (Blue)
  - Empty Jars at Cleaning Station (Amber)
  - Damaged / Scrapped Jars (Red)

---

### 5.2 Screen 2: Driver Run Sheet / Active Route Dispatch
- **Target Persona**: Delivery Driver.
- **Key Features**:
  - **Van Stock Header**: Shows "Van Stock: 40 Loaded | 22 Delivered | 18 Empty Collected | 18 Remaining".
  - **Sequential Route Stop List**: Sorted by delivery sequence order (e.g., Stop #1: Shivalik Park, Stop #2: Nilkanth Green).
  - **Stop Card UI**:
    - Customer Name & Type badge (`Residential` / `Commercial`).
    - Standard jar requirement (e.g., "Regular: 2 Jars").
    - Current dues warning badge (e.g., "Due: ₹350").
    - Action buttons:
      - Quick Green Button: `Deliver (2 Jars)` (1-tap completion).
      - Quick Call Button: Phone icon (triggers `tel:` dialer).
      - Map Navigation: Direction arrow (opens Google Maps location).

---

### 5.3 Screen 3: Operations & Delivery Log Table
- **Layout**: Responsive filterable data table with search, date-range picker, and payment mode filters (`All`, `Cash`, `UPI`, `Credit`).
- **Column Structure**:
  1. **Timestamp**: HH:MM AM/PM + relative time ("12m ago").
  2. **Customer Name & Route**: Name with link to customer drawer + Route name.
  3. **Jars Dispatched / Returned**: `+2 Full` (Green) / `-2 Empty` (Amber).
  4. **Amount & Mode**: `₹70` with payment badge (`CASH` green, `UPI` purple, `CREDIT / DUE` red).
  5. **Worker**: Driver name who recorded the trip.
  6. **Receipt / Share Action**: WhatsApp share icon to send instant receipt to customer.

---

### 5.4 Screen 4: Customer Directory & CRM Ledger
- **Layout**: Split view (Desktop: Filterable grid/table + sliding right drawer; Mobile: Full-screen list with search bar).
- **Customer Card Information**:
  - Name, Phone, Address, Route tag (`Ring Road Route`, `Satelite West`).
  - Active Jars with Customer: Counter pill (e.g., `4 Jars Holding`).
  - Outstanding Balance: High-contrast red badge if balance > 0 (e.g., `Due: ₹1,200`).
  - Security Deposit: Green badge (e.g., `Deposit: ₹600`).
- **Customer Details Drawer**:
  - Full transaction history (deliveries, payments, empty bottle returns).
  - Monthly delivery calendar heatmap.
  - Action to record standalone payment / clear dues.
  - 1-tap WhatsApp payment reminder generator with pre-filled payment link and jar ledger statement.

---

### 5.5 Screen 5: Inventory & Warehouse Stock
- **SKU Cards**:
  1. `20L Normal Water Jar`
  2. `20L Chilled Water Jar`
  3. `Electric Water Cooler Dispenser`
  4. `Manual Water Pump Dispenser`
- **Actions**:
  - Add newly purchased factory stock (+50 jars).
  - Mark damaged/leaking bottles.
  - Vehicle stock load/unload reconciliation.

---

### 5.6 Screen 6: Pre-Orders & Event Bookings
- **Cards & Statuses**:
  - `Pending` (Yellow pill)
  - `Confirmed` (Blue pill)
  - `Dispatched` (Purple pill)
  - `Delivered` (Green pill)
- **Fields**: Customer, Event date/time, Required units, Driver assigned, Rental deposit collected.

---

### 5.7 Screen 7: Accounting & Day Book
- **Summary Cards**:
  - Gross Revenue
  - Cash in Hand (Driver wallets + Plant cash register)
  - Bank / UPI Collections (HDFC/ICICI QR settlements)
  - Net Customer Dues Accrued Today
- **Export & WhatsApp Share Modal (`ExportAccountingModal`)**:
  - Date Range selector (Today, Yesterday, Last 7 Days, This Month, Custom).
  - Format options:
    - `PDF Statement` (Formatted with company letterhead, tax summary, customer dues).
    - `Excel / CSV` (Raw transactional ledger for Tally / Zoho Books).
    - `WhatsApp Share Button`:
      - Uses native `navigator.share` on mobile browsers.
      - Fallback: Pre-formatted WhatsApp Web deep link (`https://wa.me/?text=...`) containing daily summary stats and collection breakdowns.

---

### 5.8 Screen 8: 30-Day Analytics & Recharts View
- **Charts**:
  1. **Daily Water Jar Consumption Trend**: 30-day Area Chart (Sky blue gradient fill).
  2. **Payment Mode Split**: Donut / Pie Chart (Cash vs. UPI vs. Credit dues).
  3. **Route Profitability & Volume**: Bar chart comparing route performance.
  4. **Bottle Shrinkage & Loss Rate**: Monthly variance line chart.

---

### 5.9 Screen 9: Team, Roles & Permissions
- **Role Hierarchy**:
  - `Business Owner`: Full access, pricing adjustments, financial reports, user management.
  - `Dispatch Manager`: Inventory adjustments, route creation, driver reconciliation.
  - `Delivery Driver`: Dedicated driver run view, barcode scanner, delivery logger.
- **Worker Card**: Phone number, active route, assigned vehicle registration, driver status (`On Route` / `Idle`).

---

## 6. Modal & Overlay Component Specifications

### 6.1 Modal: Quick Record Delivery (`RecordDeliveryModal`)
- **Trigger**: Top bar `+ Record Delivery` button or Driver Run sheet card.
- **Fields**:
  1. Customer autocomplete dropdown (search by name, phone, or route).
  2. Jar SKU selector (`20L Normal Jar` selected by default).
  3. Quantity delivered stepper (`[-] 2 [+]`).
  4. Empty jars collected stepper (`[-] 2 [+]`).
  5. Price auto-calculation (`2 Jars × ₹35 = ₹70`).
  6. Payment mode segment toggle: `[ CASH ]` | `[ UPI / QR ]` | `[ CREDIT / DUE ]`.
  7. Notes / Remarks (Optional).
- **Submit Button**: High-visibility full-width button: `Confirm & Print / Send Receipt`.

### 6.2 Modal: Export Accounting & WhatsApp Share
- **Trigger**: Day book export action.
- **Controls**:
  - Date range selector pills: `[ Today ]` `[ Yesterday ]` `[ This Month ]`.
  - Content summary preview box showing total sales, collections, and outstanding dues.
  - Action buttons:
    - Primary Button: `Share via WhatsApp` (WhatsApp green `#25D366` with WhatsApp chat icon).
    - Secondary Button: `Download PDF Report` (Sky blue icon).
    - Secondary Button: `Download Excel / CSV` (Emerald green icon).

---

## 7. Ready-to-Use Google Stitch Prompts

Use the following formatted prompt blocks directly within Google Stitch to generate and assemble each interface module:

### Prompt 1: Global App Shell & Header Design
```text
Create a modern, clean, high-productivity B2B web application shell for "AquaPure Springs - Water Distribution & Inventory Management". 
Design a top navigation header on a crisp white background with a subtle slate-200 border:
- Left: Cyan-to-blue water droplet logo with bold brand title "AquaPure Springs" and a route badge.
- Center: Quick search input bar with magnifying glass icon and keyboard shortcut badge "Cmd+K".
- Right: Gujarati/English bilingual switch pill, a live Firestore cloud sync badge with a pulsing green dot, and a circular user profile avatar with business name dropdown.
Below the main header, add a secondary sub-bar breadcrumb navigation trail showing: "Home > Dashboard > Today's Operations".
Include top navigation tabs: Overview, Driver Run, Operations, Orders, Customers, Inventory, Team, Analytics with sky-blue active indicator pills.
Ensure clean typography using Inter, soft rounded-xl corners, and a light slate-50 background canvas.
```

### Prompt 2: Today's Performance Summary Block
```text
Design a compact, high-impact "Today's Performance" dashboard summary block for a water delivery business.
Container: Elevated white card with rounded-2xl border, subtle slate-200 outline, and light shadow.
Top row: Left side has an "Activity" icon, bold title "Today's Performance", and a glowing emerald green badge labeled "Live Overview". Right side contains two compact buttons: "+ Record Delivery" (solid sky-600) and "Export Day Book" (slate outline with download icon).
Bottom row: A 3-column responsive metric grid:
1. Total Deliveries: Large bold number "42 Trips", subtext "Customer stops completed today", with a sky-blue truck icon.
2. Jars Delivered: Large bold number "85 Jars", subtext "78 empty bottles retrieved", with a cyan droplet icon.
3. Current Day's Revenue: Large bold number "₹5,950", subtext showing pill tags "Cash: ₹3,800" and "UPI: ₹2,150", with an emerald Indian Rupee icon.
Use crisp spacing, tabular numeric fonts, and high contrast suitable for quick operational scanning.
```

### Prompt 3: Mobile Driver Run Sheet
```text
Design a mobile-first (390px width) Delivery Run Sheet screen for a water delivery van driver.
Top summary bar: Dark slate card showing "Van Stock: 40 Loaded | 22 Delivered | 18 Empty | 18 Remaining".
Body: A vertical list of delivery stops ordered by route sequence.
Each stop card contains:
- Left: Stop number pill (e.g. #01), Customer Name "Shivalik Residency Apt 402", and address in muted gray.
- Middle: Badges for "Residential", standard order "2 Jars", and overdue warning "Due: ₹140".
- Right: Quick action buttons: A prominent green button "Deliver 2 Jars", a circular phone call icon button, and a turn-by-turn map navigation icon button.
Bottom: Fixed sticky mobile action bar with large "+ New Instant Delivery" button.
Outdoor high-contrast design with 48px minimum touch targets and clean tactile feedback states.
```

### Prompt 4: Export Accounting & WhatsApp Share Modal
```text
Design a clean, modern modal dialog titled "Export Daily Accounting & Day Book".
Modal surface: White background with rounded-2xl corners, backdrop blur overlay.
Content:
1. Date filter segmented pill buttons: "Today", "Yesterday", "Last 7 Days", "Custom Range".
2. Financial summary preview card displaying: "Total Collections: ₹14,250", "Cash: ₹8,100", "UPI: ₹6,150", and "Pending Dues: ₹2,400".
3. Primary action button: A full-width WhatsApp Share button in official WhatsApp green (#25D366) with a white WhatsApp chat icon and text "Share Summary via WhatsApp".
4. Secondary download buttons in a 2-column grid: "Download PDF Report" and "Export Excel CSV".
Include a top-right close cross button and subtle helper text explaining that WhatsApp sharing uses the native device share sheet or direct web link.
```

---

## 8. Localization & Bilingual Support (English & Gujarati)

The Google Stitch design components must accommodate both English and Gujarati typography without layout shifts:

| Key UI Concept | English UI Label | Gujarati UI Label (ગુજરાતી) |
| :--- | :--- | :--- |
| Brand Subtitle | Water Distribution & Inventory | પાણી વિતરણ અને બોટલ સ્ટોક મેનેજમેન્ટ |
| Performance Block | Today's Performance | આજની કામગીરી |
| Total Deliveries | Total Deliveries | કુલ ડિલિવરી |
| Jars Delivered | Jars Delivered | વિતરિત કરેલા જાર |
| Day's Revenue | Current Day's Revenue | આજની કુલ આવક |
| Record Delivery | + Record Delivery | + ડિલિવરી નોંધો |
| Export Day Book | Export Day Book | ડે બુક એક્સપોર્ટ |
| Jars in Hand | Jars Holding | ગ્રાહક પાસે જાર |
| Overdue Amount | Outstanding Balance | બાકી રકમ |
| Payment Mode | Cash / UPI / Credit | રોકડ / યુપીઆઈ / બાકી |

---

## 9. Quality, Accessibility & Edge States

1. **Touch Ergonomics**: All interactive buttons, stepper selectors, and tabs must maintain a minimum target height of 44px (mobile 48px).
2. **Tabular Numerics**: All Indian Rupee amounts (`₹`) and inventory counters must use monospace tabular figure styling to prevent layout jitter when values increment in real-time.
3. **Empty States**:
   - Deliveries Table: Clean vector illustration of a delivery van with message: *"No deliveries recorded yet today. Tap + Record Delivery to log your first stop."*
   - Customer Search: Search glass icon with text: *"No matching customer found. Add as new customer?"*
4. **Offline Resilience Indicators**: When disconnected, top sync badge switches from green to amber pill with text *"Offline Mode - 3 deliveries queued for sync"*.
5. **No Visual AI Clutter**: Pure operational utility — no unnecessary chatbots, floating assistance widgets, or superfluous decorative animations that slow down field drivers.
