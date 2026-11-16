# Handoff Report — Tier 1 & Tier 2 E2E Test Case Design

## 1. Observation

### Direct Document & Code Observations
1. **`d:/StockTracker/ORIGINAL_REQUEST.md`**:
   - **Line 10**: "Refactor and fix the inventory reports page (`reports.tsx`) to resolve critical missing JSX blocks, optimize performance via memoization, enforce accessibility/theming standards, and integrate audit logging for report exports."
   - **Line 18**: "Split the monolithic `reports.tsx` (2,240 lines) into dedicated sub-report components within `client/src/components/reports/` (`StockBalanceReport.tsx`, `IssuanceReport.tsx`, `ReceivingReport.tsx`, `ConsumableReport.tsx`, `MonthlyUsageReport.tsx`, `ReturnToStockReport.tsx`). Ensure the missing `ReturnToStockReport` JSX block is fully implemented and rendered correctly when active."
   - **Line 21**: "Implement `useMemo` for all heavy data transformations, sorting, and slicing (e.g., `allParts`, `topParts`, `equipmentBreakdown`). Implement `useCallback` for all export handlers (`exportToCSV`, `exportToPDF`) to prevent unnecessary function recreation across renders."
   - **Line 24**: "Integrate client-side audit event dispatching (`agent.action`, `export_report`) when users export reports to CSV or PDF, ensuring robust traceability in line with `agent-audit-logging` standards."
   - **Line 27**: "Replace hardcoded Recharts hex colors (`BAR_COLORS`) with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons, pagination controls, and tabs. Ensure all empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading."
   - **Line 31-37**: Requires programmatic verification (`tsc --noEmit`, `vite build`) and functional verification (clicking `return-to-stock-report` tab successfully renders the Return to Stock Report table UI; `reports.tsx` acts cleanly as a parent tab container).

2. **`d:/StockTracker/.agents/teamwork_preview_orchestrator_main_1/PROJECT.md`**:
   - **Lines 4-6**: Specifies module boundaries at `client/src/components/reports/` with `reports.tsx` managing active tab state and rendering corresponding sub-report components.
   - **Line 15**: Milestone 5 defines "E2E Testing Track: Design & implement opaque-box E2E test suite (Tiers 1-4) for reports page, publish TEST_READY.md".

3. **`d:/StockTracker/.agents/sub_orch_e2e_testing_1/SCOPE.md`**:
   - **Lines 4-6**: "Requirement-driven, opaque-box E2E test suite derived from `ORIGINAL_REQUEST.md` and user-facing specs, not implementation internals. ... Systematic 4-tier approach: Tier 1 (Feature Coverage >=5 per feature), Tier 2 (Boundary & Corner Cases >=5 per feature), Tier 3 (Cross-Feature Combinations), Tier 4 (Real-World Application Scenarios)."
   - **Line 16**: "Opaque-box testing only. Do NOT depend on implementation internals or modify application source code."

4. **`d:/StockTracker/client/src/pages/reports.tsx`**:
   - **Lines 107-117**: Manages monolithic state: `activeReport`, `search`, `categoryFilter`, `statusFilter`, `page`, `selectedYear`, `selectedMonth`, `expandedEq`.
   - **Lines 279-287**: Queries `/api/stock-returns?page=...&search=...` when `activeReport === "return-to-stock-report"`.
   - **Lines 453-2236**: Contains conditional JSX blocks for `stock-balance`, `issuance-report`, `receiving-report`, `consumable-report`, `analytics`, and `monthly-usage`. **Missing**: The JSX block for `activeReport === "return-to-stock-report"` is completely absent from the render return.
   - **Line 102**: Hardcoded Recharts hex colors `const BAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];`.
   - **Lines 119-171**: Client-side CSV/PDF export functions without audit logging dispatches.

---

## 2. Logic Chain

1. **Feature Identification**: Based on `ORIGINAL_REQUEST.md` and `PROJECT.md`, the inventory reports page encompasses 10 distinct architectural and functional features/dimensions:
   - **F1: `reports.tsx` Parent Tab Container**: Manages active tab state, renders tab buttons, and acts as a delegator to child components.
   - **F2: StockBalance Report**: Displays stock balances, category/status/search filters, summary KPI cards, stock status badges, and pagination.
   - **F3: Issuance Report**: Displays item issuances, issue numbers, requested by, date formatting, and detailed view modals.
   - **F4: Receiving Report**: Displays receiving records, suppliers, invoice numbers, store IDs, receipt links, and item breakdowns.
   - **F5: Consumable Report**: Displays consumable item issuances, item names, units, quantities, and empty states.
   - **F6: MonthlyUsage Report**: Displays usage summaries, month/year selectors, KPI cards, usage ranking tables, spike alerts, Recharts bar charts, and equipment (EQ.NO) breakdown accordions.
   - **F7: ReturnToStock Report**: The previously missing UI tab that must render stock return records, search filters, pagination, return dates, and item lists.
   - **F8: Export Actions & Audit Logging**: Covers CSV/PDF export handlers across all sub-reports and verifies the invocation of client-side audit event dispatching (`agent.action`, `export_report`).
   - **F9: Theming**: Enforces replacement of hardcoded colors with semantic CSS variables and Tailwind theme variables (e.g. `--lion-red-500`, `--primary`).
   - **F10: Accessibility (a11y)**: Ensures presence of `<h1>` headings, `aria-label` attributes on icon buttons/tabs/pagination, keyboard navigation, and WCAG AA contrast ratios (>= 4.5:1) on empty states.

2. **Test Design & Tier Allocation**:
   - **Tier 1 (Feature Coverage)**: Requires >=5 test cases per feature (50 total). These validate standard positive workflows, typical user interactions, standard data rendering, and expected interface behavior under normal conditions.
   - **Tier 2 (Boundary & Corner Cases)**: Requires >=5 test cases per feature (50 total). These validate edge cases, extreme inputs, empty states, huge datasets, malformed responses, network latency/timeouts, boundary pagination, rapid switching, and zero/negative values.

3. **Opaque-Box Observability**:
   - Every test case must specify exact inputs (URL, mock API responses, window dimensions, keyboard/mouse events), user actions (clicks, inputs, keypresses), and opaque-box observable verification outputs (DOM element presence, text content, CSS property values, ARIA attribute states, downloaded file headers/names, window console/network audit logs).

---

## 3. Caveats

1. **Read-Only Scope**: This report provides test case designs only. No execution of these tests or modifications to application code were performed during this exploration phase.
2. **Opaque-Box Abstraction**: The test designs do not rely on React internal component state, virtual DOM fiber trees, or specific variable names in the refactored files. All expected outputs rely strictly on standard DOM inspection, API network interception, browser event logs, and visual contrast measurements.
3. **Audit Logging Inspection**: Since `agent.action` event dispatching is specified as a client-side mechanism, verification expects observation via `window.dispatchEvent`, browser console logs, or outgoing network requests to an audit endpoint.

---

## 4. Conclusion

Below is the exhaustive Feature Inventory and the complete Tier 1 and Tier 2 test case specifications (100 test cases total).

### Feature Inventory Summary
| Feature ID | Feature Name | Description | Tier 1 Tests | Tier 2 Tests | Total Tests |
|---|---|---|---|---|---|
| **F1** | `reports.tsx` Parent Tab Container | Tab layout, switching, analytics view, child delegation | 5 | 5 | 10 |
| **F2** | `StockBalance` Report | Stock balance table, filters, KPI summary cards, pagination | 5 | 5 | 10 |
| **F3** | `Issuance` Report | Issuance records, date formats, detailed modal view | 5 | 5 | 10 |
| **F4** | `Receiving` Report | Receiving records, supplier info, invoice display, item view | 5 | 5 | 10 |
| **F5** | `Consumable` Report | Consumable item issuances, unit tracking, empty states | 5 | 5 | 10 |
| **F6** | `MonthlyUsage` Report | Monthly usage, Recharts bar chart, spike alerts, EQ.NO breakdown | 5 | 5 | 10 |
| **F7** | `ReturnToStock` Report | Newly added stock return view, search filter, item display | 5 | 5 | 10 |
| **F8** | Export Actions & Audit Logging | CSV/PDF exports, client-side audit event dispatching | 5 | 5 | 10 |
| **F9** | Theming | Semantic CSS variables, Tailwind theme variables | 5 | 5 | 10 |
| **F10** | Accessibility (a11y) | `<h1>` headings, `aria-label`, WCAG AA contrast, keyboard nav | 5 | 5 | 10 |
| **Total**| | | **50** | **50** | **100** |

---

### Tier 1: Feature Coverage Test Cases (50 Tests)

#### F1: `reports.tsx` Parent Tab Container
* **T1.F1.1: Default Tab Rendering**
  * **Objective**: Verify that navigating to `/reports` loads the default tab correctly.
  * **Exact Test Inputs**: Navigate to URL `/reports` with mock API returning standard stats.
  * **User Actions**: Initial page load.
  * **Expected Verification Outputs**: DOM contains the tab navigation bar; the "Analytics" tab button has the active styling (`variant="default"` / active background); the Analytics dashboard metrics are visible in the DOM.
* **T1.F1.2: Tab Navigation Switching**
  * **Objective**: Verify clean delegation and rendering when switching from Analytics to Stock Balance.
  * **Exact Test Inputs**: Active page `/reports`, mock API `/api/parts?page=1&limit=50` returning 2 parts.
  * **User Actions**: Click on the tab button with text "Stock Balance".
  * **Expected Verification Outputs**: DOM removes Analytics cards and mounts Stock Balance CardHeader and Table; active tab styling shifts to the "Stock Balance" button.
* **T1.F1.3: Tab Title and Description Display**
  * **Objective**: Verify all 7 report tabs display their expected titles and descriptions in the navigation header.
  * **Exact Test Inputs**: Navigate to `/reports`.
  * **User Actions**: Inspect navigation container.
  * **Expected Verification Outputs**: DOM contains 7 distinct buttons inside the navigation card containing correct title strings (e.g., "Issuance Report", "Receiving Report", "Return to Stock", "Stock Balance", "Consumable Items", "Monthly Usage", "Analytics") and corresponding sub-descriptions.
* **T1.F1.4: Tab State Retention on Switching**
  * **Objective**: Verify that switching away from a tab and back cleanly delegates rendering without duplicating containers.
  * **Exact Test Inputs**: Active page `/reports`.
  * **User Actions**: Click "Stock Balance", then click "Issuance Report", then click "Stock Balance" again.
  * **Expected Verification Outputs**: DOM contains exactly one instance of the Stock Balance table; no duplicate headers or leaked DOM elements from Issuance Report exist.
* **T1.F1.5: Analytics Data Auto-Refetch on Tab Click**
  * **Objective**: Verify that clicking the Analytics tab triggers a refetch of dashboard statistics.
  * **Exact Test Inputs**: Active page `/reports` on "Stock Balance" tab; network interceptor tracking `/api/dashboard/stats`.
  * **User Actions**: Click the "Analytics" tab button.
  * **Expected Verification Outputs**: Network log shows a fresh GET request to `/api/dashboard/stats`; DOM populates with updated metrics.

#### F2: `StockBalance` Report
* **T1.F2.1: Stock Balance Table Rendering**
  * **Objective**: Verify correct rendering of part data in the stock balance table.
  * **Exact Test Inputs**: Mock `/api/parts?page=1&limit=50` returning Part `[id: 1, partNo: "PART-001", description: "Bolt", currentStock: 50, minimumStock: 10, binLocation: "A1", category: {name: "Hardware"}]`.
  * **User Actions**: Click "Stock Balance" tab.
  * **Expected Verification Outputs**: Table row exists with text "PART-001", "Bolt", "Hardware", "50", "10", "A1", and a badge with "Normal Stock".
* **T1.F2.2: Category Filtering**
  * **Objective**: Verify that selecting a category filters the parts list.
  * **Exact Test Inputs**: Mock `/api/categories` returning `[{id: 101, name: "Electrical"}]`. Mock `/api/parts?page=1&limit=50&categoryId=101` returning 1 electrical part.
  * **User Actions**: Open Category select dropdown, click "Electrical".
  * **Expected Verification Outputs**: Network request fires with `categoryId=101`; table updates to display the electrical part.
* **T1.F2.3: Stock Status Filtering**
  * **Objective**: Verify filtering by stock level status (e.g., Low Stock).
  * **Exact Test Inputs**: Mock `/api/parts?page=1&limit=50&status=low` returning parts where `currentStock <= minimumStock`.
  * **User Actions**: Open Status select dropdown, click "Low Stock".
  * **Expected Verification Outputs**: Network request fires with `status=low`; table displays only items with "Low Stock" badges.
* **T1.F2.4: Text Search Filtering**
  * **Objective**: Verify text search input queries the parts inventory.
  * **Exact Test Inputs**: Enter search string "Valve" into search input; mock `/api/parts?page=1&limit=50&search=Valve`.
  * **User Actions**: Type "Valve" into search box.
  * **Expected Verification Outputs**: Network request fires with `search=Valve`; table displays matching valve items.
* **T1.F2.5: Pagination Controls**
  * **Objective**: Verify next page navigation updates the page parameter and table contents.
  * **Exact Test Inputs**: Mock `/api/parts?page=1&limit=50` with `total: 120`. Mock `/api/parts?page=2&limit=50`.
  * **User Actions**: Click "Next" button in pagination area.
  * **Expected Verification Outputs**: Network request fires with `page=2`; pagination text displays "Showing 51 to 100 of 120 items".

#### F3: `Issuance` Report
* **T1.F3.1: Issuance Table Rendering**
  * **Objective**: Verify issuance records are displayed correctly in the table.
  * **Exact Test Inputs**: Mock `/api/issuances?limit=0` returning `[id: 1, issueNumber: "ISS-1001", requestedBy: "John Doe", issueDate: "2026-06-28T05:00:00Z", items: [{}], status: "Completed"]`.
  * **User Actions**: Click "Issuance Report" tab.
  * **Expected Verification Outputs**: Table row contains "ISS-1001", formatted date, "John Doe", "1 items", and "Completed" badge.
* **T1.F3.2: Issuance Detail Modal Opening**
  * **Objective**: Verify clicking 'View' opens the detailed issuance modal.
  * **Exact Test Inputs**: Issuance table rendered with "ISS-1001".
  * **User Actions**: Click "View" button on the "ISS-1001" row.
  * **Expected Verification Outputs**: DOM mounts a Dialog modal containing header "Issuance Details - ISS-1001" and a sub-table of issued items.
* **T1.F3.3: Issuance Modal Item List Display**
  * **Objective**: Verify item breakdown inside the issuance detail modal.
  * **Exact Test Inputs**: Modal open for issuance with item `[part: {partNo: "P-1", description: "Gear", binLocation: "B2"}, quantity: 5, notes: "Urgent"]`.
  * **User Actions**: Inspect open modal table.
  * **Expected Verification Outputs**: Modal table row contains "P-1", "Gear", "5", "B2", "Urgent".
* **T1.F3.4: Issuance Modal Notes Display**
  * **Objective**: Verify general issuance notes appear in the detail modal when present.
  * **Exact Test Inputs**: Issuance record containing `notes: "Deliver to Hangar B"`.
  * **User Actions**: Click "View" button on the issuance row.
  * **Expected Verification Outputs**: Modal contains a section with label "Notes" and text "Deliver to Hangar B".
* **T1.F3.5: Issuance Print Rendering**
  * **Objective**: Verify clicking Print generates the HTML table for printing.
  * **Exact Test Inputs**: Issuance data present in table; mock `window.open`.
  * **User Actions**: Click "Print" button in Issuance CardHeader.
  * **Expected Verification Outputs**: `window.open` is called; written HTML document contains `<h1>GSE MTN STOCK</h1>` and `<table>` with issuance records.

#### F4: `Receiving` Report
* **T1.F4.1: Receiving Table Rendering**
  * **Objective**: Verify receiving records are displayed correctly in the table.
  * **Exact Test Inputs**: Mock `/api/receivings?page=1&limit=50` returning `[id: 1, receiveNumber: "REC-2001", supplier: "Acme Corp", storeId: "ST-01", invoiceNumber: "INV-999", items: [{}, {}], status: "Received"]`.
  * **User Actions**: Click "Receiving Report" tab.
  * **Expected Verification Outputs**: Table row contains "REC-2001", "Acme Corp", "ST-01", "INV-999", "2 items", "Received" badge.
* **T1.F4.2: Receiving Detail Modal Opening**
  * **Objective**: Verify clicking 'View' opens the receiving detail modal.
  * **Exact Test Inputs**: Receiving table rendered with "REC-2001".
  * **User Actions**: Click "View" button on the "REC-2001" row.
  * **Expected Verification Outputs**: DOM mounts a Dialog modal containing header "Receiving Details - REC-2001".
* **T1.F4.3: Receiving Modal Receipt Link Display**
  * **Objective**: Verify receipt image links appear in the modal when `imageUrl` is provided.
  * **Exact Test Inputs**: Receiving record containing `imageUrl: "https://example.com/receipt.jpg"`.
  * **User Actions**: Click "View" button on the receiving row.
  * **Expected Verification Outputs**: Modal contains a "View Receipt" anchor tag with `href="https://example.com/receipt.jpg"` and `target="_blank"`.
* **T1.F4.4: Receiving Modal Item Pricing Display**
  * **Objective**: Verify item unit price and details appear in the modal table.
  * **Exact Test Inputs**: Receiving item `[part: {partNo: "P-2", description: "Motor"}, quantity: 2, unitPrice: "150.00", notes: "New"]`.
  * **User Actions**: Open receiving modal.
  * **Expected Verification Outputs**: Modal table row contains "P-2", "Motor", "2", "150.00", "New".
* **T1.F4.5: Receiving Print Rendering**
  * **Objective**: Verify clicking Print generates the receiving print document.
  * **Exact Test Inputs**: Receiving data present; mock `window.open`.
  * **User Actions**: Click "Print" button in Receiving CardHeader.
  * **Expected Verification Outputs**: `window.open` is called; written HTML document contains receiving table with columns "Receive Number", "Supplier", "Store ID", "Invoice".

#### F5: `Consumable` Report
* **T1.F5.1: Consumable Table Rendering**
  * **Objective**: Verify consumable issuance records appear in the table.
  * **Exact Test Inputs**: Mock `/api/consumable-issuances?page=1&limit=50` returning `[id: 1, issueNumber: "CON-3001", requestedBy: "Jane Smith", storeId: "ST-02", items: [{}], status: "Issued"]`.
  * **User Actions**: Click "Consumable Items" tab.
  * **Expected Verification Outputs**: Table row contains "CON-3001", "Jane Smith", "ST-02", "1 items", "Issued".
* **T1.F5.2: Consumable Detail Modal Opening**
  * **Objective**: Verify clicking 'View' opens the consumable detail modal.
  * **Exact Test Inputs**: Consumable table rendered with "CON-3001".
  * **User Actions**: Click "View" button on the "CON-3001" row.
  * **Expected Verification Outputs**: DOM mounts a Dialog modal containing header "Consumable Issuance Details - CON-3001".
* **T1.F5.3: Consumable Item Details Display**
  * **Objective**: Verify consumable specific fields (itemName, unit) appear in the modal table.
  * **Exact Test Inputs**: Consumable item `[consumableItem: {itemName: "Grease", description: "Lubricant", unit: "Tube"}, quantity: 10, notes: "Maintenance"]`.
  * **User Actions**: Open consumable modal.
  * **Expected Verification Outputs**: Modal table row contains "Grease", "Lubricant", "10", "Tube", "Maintenance".
* **T1.F5.4: Consumable Empty Item Handling in Modal**
  * **Objective**: Verify fallback text when consumable item data lacks notes.
  * **Exact Test Inputs**: Consumable item with `notes: null`.
  * **User Actions**: Open consumable modal.
  * **Expected Verification Outputs**: Modal table row displays "-" in the Notes column.
* **T1.F5.5: Consumable Print Rendering**
  * **Objective**: Verify clicking Print generates the consumable print document.
  * **Exact Test Inputs**: Consumable data present; mock `window.open`.
  * **User Actions**: Click "Print" button in Consumable CardHeader.
  * **Expected Verification Outputs**: `window.open` is called; written HTML document contains consumable table with columns "Issue Number", "Requested By", "Store ID".

#### F6: `MonthlyUsage` Report
* **T1.F6.1: Monthly Usage Header and Selectors Rendering**
  * **Objective**: Verify the monthly usage header, month dropdown, and year dropdown render correctly.
  * **Exact Test Inputs**: Mock `/api/reports/monthly-usage?year=2026&month=6` returning standard summary.
  * **User Actions**: Click "Monthly Usage" tab.
  * **Expected Verification Outputs**: DOM contains Select dropdowns displaying "June" and "2026"; KPI summary cards are visible.
* **T1.F6.2: KPI Summary Card Calculations**
  * **Objective**: Verify KPI cards correctly display summary totals and change percentages.
  * **Exact Test Inputs**: Mock summary `[totalPartsUsed: 1500, changePercent: 12.5, totalIssuanceCount: 45, uniquePartCount: 30, uniqueEquipmentCount: 12]`.
  * **User Actions**: Inspect KPI cards on Monthly Usage tab.
  * **Expected Verification Outputs**: KPI cards display "1,500" ("+12.5% vs last month"), "45", "30", and "12".
* **T1.F6.3: Top Used Parts Bar Chart Rendering**
  * **Objective**: Verify the Recharts BarChart container mounts when top parts data exists.
  * **Exact Test Inputs**: Mock `topParts: [{partNo: "P-101", description: "Filter", totalQty: 500, issueCount: 15, equipmentNos: ["EQ-01"]}]`.
  * **User Actions**: Inspect chart container.
  * **Expected Verification Outputs**: DOM contains `.recharts-wrapper` and `.recharts-surface` elements representing the top parts bar chart.
* **T1.F6.4: Usage Ranking Table Display**
  * **Objective**: Verify the All Parts ranking table displays medal icons and usage progress bars.
  * **Exact Test Inputs**: Mock `allParts` with 4 items; first item `partNo: "P-001", totalQty: 100`.
  * **User Actions**: Inspect Usage Ranking table.
  * **Expected Verification Outputs**: First row contains medal icon "🥇", text "P-001", "100", and a progress bar representing 100%. Fourth row contains "#4".
* **T1.F6.5: Equipment Breakdown Accordion Expansion**
  * **Objective**: Verify clicking an equipment row expands the sub-table showing part breakdown.
  * **Exact Test Inputs**: Mock `equipmentBreakdown: [{equipmentNo: "EQ-999", totalQty: 50, parts: [{partNo: "P-001", description: "Bolt", qty: 50}]}]`.
  * **User Actions**: Click the button containing text "EQ-999".
  * **Expected Verification Outputs**: Accordion expands; sub-table mounts containing header "Part No.", "Description", "Qty Used" and row "P-001", "Bolt", "50".

#### F7: `ReturnToStock` Report
* **T1.F7.1: Return to Stock Table Rendering**
  * **Objective**: Verify the previously missing Return to Stock JSX block renders correctly when its tab is active.
  * **Exact Test Inputs**: Mock `/api/stock-returns?page=1&limit=50&search=` returning `[stockReturns: [{id: 1, partNo: "RET-001", description: "Engine Valve", quantity: 5, returnedAt: "2026-06-28T10:00:00Z", returnedBy: "Tech A", notes: "Overstock", issueNumber: "ISS-555"}], total: 1]`.
  * **User Actions**: Click "Return to Stock" tab.
  * **Expected Verification Outputs**: Table container mounts successfully; table row contains "RET-001", "Engine Valve", "5", formatted date, "Tech A", "Overstock", "ISS-555".
* **T1.F7.2: Return to Stock Search Filtering**
  * **Objective**: Verify typing in the Return to Stock search input filters the return records.
  * **Exact Test Inputs**: Enter search string "Valve" into search input; mock `/api/stock-returns?page=1&limit=50&search=Valve`.
  * **User Actions**: Type "Valve" into search box on Return to Stock tab.
  * **Expected Verification Outputs**: Network request fires with `search=Valve`; table updates with matching return records.
* **T1.F7.3: Return to Stock Pagination Controls**
  * **Objective**: Verify pagination controls function correctly within the Return to Stock view.
  * **Exact Test Inputs**: Mock `/api/stock-returns?page=1&limit=50&search=` with `total: 80`. Mock `/api/stock-returns?page=2&limit=50&search=`.
  * **User Actions**: Click "Next" button in Return to Stock pagination area.
  * **Expected Verification Outputs**: Network request fires with `page=2`; pagination text displays "Showing 51 to 80 of 80 items".
* **T1.F7.4: Return to Stock Optional Issue Number Handling**
  * **Objective**: Verify correct fallback display when a return record lacks an associated issue number.
  * **Exact Test Inputs**: Return record with `issueNumber: null`.
  * **User Actions**: Inspect Return to Stock table row.
  * **Expected Verification Outputs**: Table row displays "-" or "N/A" in the Issue Number column.
* **T1.F7.5: Return to Stock Print Rendering**
  * **Objective**: Verify clicking Print generates the return to stock print document.
  * **Exact Test Inputs**: Return to stock data present; mock `window.open`.
  * **User Actions**: Click "Print" button in Return to Stock CardHeader.
  * **Expected Verification Outputs**: `window.open` is called; written HTML document contains return to stock table with columns "Part No.", "Description", "Quantity", "Returned By".

#### F8: Export Actions & Audit Logging
* **T1.F8.1: Stock Balance CSV Export & Audit Log**
  * **Objective**: Verify exporting Stock Balance to CSV triggers file download and dispatches an audit event.
  * **Exact Test Inputs**: Stock Balance tab active; mock `fetchAllPartsForExport` returning 1 part; monitor `window` for `agent.action` custom event or audit network endpoint.
  * **User Actions**: Click "Export Excel" (CSV) button.
  * **Expected Verification Outputs**: CSV Blob is generated and downloaded with filename prefix `stock-balance-`; audit event `export_report` with metadata `{report: "Stock Balance", format: "CSV"}` is dispatched and observable in console/network logs.
* **T1.F8.2: Stock Balance PDF Export & Audit Log**
  * **Objective**: Verify exporting Stock Balance to PDF triggers jsPDF save and dispatches an audit event.
  * **Exact Test Inputs**: Stock Balance tab active; mock `fetchAllPartsForExport`.
  * **User Actions**: Click "PDF" export button.
  * **Expected Verification Outputs**: jsPDF `save()` is called with filename prefix `stock-balance-report-`; audit event `export_report` with metadata `{report: "Stock Balance", format: "PDF"}` is dispatched.
* **T1.F8.3: Issuance Report CSV Export & Audit Log**
  * **Objective**: Verify exporting Issuance Report to CSV triggers download and audit log.
  * **Exact Test Inputs**: Issuance Report tab active with loaded data.
  * **User Actions**: Click "Export Excel" (CSV) button.
  * **Expected Verification Outputs**: CSV file downloaded with prefix `issuance-report-`; audit event `export_report` with metadata `{report: "Issuance Report", format: "CSV"}` is dispatched.
* **T1.F8.4: Receiving Report PDF Export & Audit Log**
  * **Objective**: Verify exporting Receiving Report to PDF triggers jsPDF save and audit log.
  * **Exact Test Inputs**: Receiving Report tab active with loaded data.
  * **User Actions**: Click "PDF" export button.
  * **Expected Verification Outputs**: PDF file saved with prefix `receiving-report-`; audit event `export_report` with metadata `{report: "Receiving Report", format: "PDF"}` is dispatched.
* **T1.F8.5: Monthly Usage CSV Export & Audit Log**
  * **Objective**: Verify exporting Monthly Usage to CSV triggers download and audit log.
  * **Exact Test Inputs**: Monthly Usage tab active with loaded data for June 2026.
  * **User Actions**: Click "CSV" export button.
  * **Expected Verification Outputs**: CSV file downloaded with filename `monthly-usage-2026-06.csv`; audit event `export_report` with metadata `{report: "Monthly Usage", format: "CSV"}` is dispatched.

#### F9: Theming
* **T1.F9.1: Semantic CSS Variables in Recharts**
  * **Objective**: Verify that Recharts bars receive semantic CSS variables instead of hardcoded hex colors.
  * **Exact Test Inputs**: Monthly Usage tab active with Top Parts chart rendered.
  * **User Actions**: Inspect `<path>` or `<rect>` elements inside the Recharts SVG container.
  * **Expected Verification Outputs**: Element `fill` attribute or computed style matches semantic CSS variables (e.g., `var(--recharts-bar-1)` or `var(--primary)`) rather than `#ef4444`.
* **T1.F9.2: Tailwind Theme Variable Application on Active Tab**
  * **Objective**: Verify active tab buttons use Tailwind theme variables for background styling.
  * **Exact Test Inputs**: Active page `/reports`.
  * **User Actions**: Inspect active tab button (e.g., "Analytics").
  * **Expected Verification Outputs**: Element class list contains semantic theme classes (e.g., `bg-primary` or `bg-lion-red-500`) rather than arbitrary hardcoded hex classes.
* **T1.F9.3: Dark Mode Theme Support on Table Rows**
  * **Objective**: Verify table alternating rows and headers adapt to dark mode class overrides.
  * **Exact Test Inputs**: Toggle HTML `class="dark"` on document root.
  * **User Actions**: Inspect TableHeader and TableBody rows across Stock Balance tab.
  * **Expected Verification Outputs**: Table header computed background matches dark mode theme variable (e.g., `dark:bg-gray-800`); text colors compute to `dark:text-white` or `dark:text-gray-300`.
* **T1.F9.4: Badge Theming Consistency**
  * **Objective**: Verify stock status badges adhere to semantic theme colors.
  * **Exact Test Inputs**: Stock Balance table rendered with Normal, Low, and Out of Stock items.
  * **User Actions**: Inspect Badge elements.
  * **Expected Verification Outputs**: Normal stock badge uses theme variable classes (e.g., `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`); Low stock uses yellow theme variables; Out of stock uses red/destructive theme variables.
* **T1.F9.5: Modal Theme Consistency**
  * **Objective**: Verify Dialog content popups match the active application theme variables.
  * **Exact Test Inputs**: Open Issuance detail modal while in dark mode.
  * **User Actions**: Inspect DialogContent container.
  * **Expected Verification Outputs**: Modal background matches dark mode surface variable (`dark:bg-gray-900` or `dark:bg-gray-800`); borders match `dark:border-gray-700`.

#### F10: Accessibility (a11y)
* **T1.F10.1: Main Heading `<h1>` Presence**
  * **Objective**: Verify the main reports page contains a clear, top-level `<h1>` heading for screen readers.
  * **Exact Test Inputs**: Navigate to `/reports`.
  * **User Actions**: Inspect DOM structure.
  * **Expected Verification Outputs**: DOM contains exactly one `<h1>` element with text content such as "Reports and Analytics" or "GSE MTN STOCK Reports".
* **T1.F10.2: Tab Navigation `aria-label` Attributes**
  * **Objective**: Verify all tab navigation buttons contain descriptive `aria-label` attributes.
  * **Exact Test Inputs**: Navigate to `/reports`.
  * **User Actions**: Inspect tab button DOM elements.
  * **Expected Verification Outputs**: Each tab button has a valid `aria-label` attribute (e.g., `aria-label="Switch to Stock Balance Report tab"`).
* **T1.F10.3: Icon Button `aria-label` Attributes**
  * **Objective**: Verify standalone icon buttons or icon-heavy buttons (Export, Print, View) contain `aria-label` attributes.
  * **Exact Test Inputs**: Stock Balance tab active.
  * **User Actions**: Inspect Export CSV, Export PDF, Print, and table row View buttons.
  * **Expected Verification Outputs**: Export buttons have `aria-label="Export Stock Balance to CSV"`, `aria-label="Export Stock Balance to PDF"`, `aria-label="Print Stock Balance Report"`; table View buttons have `aria-label="View details for part PART-001"`.
* **T1.F10.4: Pagination Control `aria-label` Attributes**
  * **Objective**: Verify pagination Previous/Next buttons contain `aria-label` attributes.
  * **Exact Test Inputs**: Stock Balance tab active with multiple pages.
  * **User Actions**: Inspect pagination button elements.
  * **Expected Verification Outputs**: Previous button has `aria-label="Go to previous page"`; Next button has `aria-label="Go to next page"`.
* **T1.F10.5: Empty State WCAG AA Contrast Ratio**
  * **Objective**: Verify text and background contrast in empty states satisfies WCAG AA requirement (>= 4.5:1).
  * **Exact Test Inputs**: Consumable tab active with mock API returning `[]` (empty list).
  * **User Actions**: Inspect empty state container and text.
  * **Expected Verification Outputs**: Computed foreground text color (e.g., `#4b5563` or `#9ca3af` in dark mode) against computed background color (`#ffffff` or `#1f2937`) produces a measured contrast ratio >= 4.5:1.

---

### Tier 2: Boundary & Corner Cases Test Cases (50 Tests)

#### F1: `reports.tsx` Parent Tab Container
* **T2.F1.1: Rapid Tab Switching Stress Test**
  * **Objective**: Verify application stability and lack of race conditions during rapid, repeated tab switching.
  * **Exact Test Inputs**: Active page `/reports`. Mock APIs configured with variable latency (100ms - 500ms).
  * **User Actions**: Click "Stock Balance", "Issuance", "Receiving", "Return to Stock", and "Analytics" in rapid succession (<50ms between clicks).
  * **Expected Verification Outputs**: Application does not crash; no unhandled promise rejections occur; final rendered UI matches only the last clicked tab ("Analytics"); no ghost table elements from earlier tabs remain in the DOM.
* **T2.F1.2: Unknown Tab State Handling**
  * **Objective**: Verify fallback behavior if an invalid or deprecated tab ID is forcefully set in state/URL.
  * **Exact Test Inputs**: Force component state or URL parameter to `activeReport="non-existent-tab"`.
  * **User Actions**: Re-render component.
  * **Expected Verification Outputs**: Container gracefully falls back to the default tab ("analytics") or displays a clean, accessible error message without throwing a fatal React runtime error.
* **T2.F1.3: Network Timeout on Tab Mount**
  * **Objective**: Verify UI behavior when switching to a tab whose API request times out.
  * **Exact Test Inputs**: Switch to "Stock Balance" tab; mock API `/api/parts` configured to time out after 10 seconds or return 504 Gateway Timeout.
  * **User Actions**: Click "Stock Balance" tab.
  * **Expected Verification Outputs**: Loading spinner displays initially; upon timeout, a clean error state or toast notification appears; tab navigation remains fully interactive.
* **T2.F1.4: Extreme Viewport Resizing (Responsive Flow)**
  * **Objective**: Verify tab navigation grid adapts correctly without clipping text on extreme screen sizes.
  * **Exact Test Inputs**: Resize browser viewport width to 320px (mobile small) and 2560px (ultra-wide).
  * **User Actions**: Observe tab navigation grid layout.
  * **Expected Verification Outputs**: At 320px, buttons stack cleanly or wrap without horizontal overflow or text clipping; at 2560px, grid spans cleanly across columns as defined by Tailwind responsive prefixes.
* **T2.F1.5: Keyboard Navigation Tab Loop**
  * **Objective**: Verify users can seamlessly navigate through all tab buttons using only the `Tab` and `Enter` keys.
  * **Exact Test Inputs**: Initial load of `/reports`.
  * **User Actions**: Press `Tab` to focus the first tab button, press `Tab` repeatedly to cycle through all 7 buttons, press `Enter` on "Return to Stock".
  * **Expected Verification Outputs**: Focus indicator moves visibly across each tab button in sequence; pressing `Enter` successfully activates the "Return to Stock" tab and mounts its child component.

#### F2: `StockBalance` Report
* **T2.F2.1: Zero Parts Empty State**
  * **Objective**: Verify Stock Balance UI behavior when the entire inventory is empty.
  * **Exact Test Inputs**: Mock `/api/parts?page=1&limit=50` returning `{parts: [], total: 0}`.
  * **User Actions**: Click "Stock Balance" tab.
  * **Expected Verification Outputs**: Table renders an empty state row with text "No parts found" or similar; pagination displays "Showing 0 to 0 of 0 items"; Previous/Next buttons are disabled.
* **T2.F2.2: Extreme Dataset Rendering (9999 items in export)**
  * **Objective**: Verify export helper handles massive datasets without crashing or freezing the main thread.
  * **Exact Test Inputs**: Mock `fetchAllPartsForExport` returning 9,999 parts.
  * **User Actions**: Click "Export Excel".
  * **Expected Verification Outputs**: Loading spinner button state activates during processing; CSV Blob generates successfully with 10,000 rows (1 header + 9999 data); UI remains responsive post-download.
* **T2.F2.3: Malformed Part Data Handling**
  * **Objective**: Verify table robustness when API returns parts with missing or null fields.
  * **Exact Test Inputs**: Mock `/api/parts` returning Part `[id: 99, partNo: null, description: undefined, currentStock: null, minimumStock: -5, binLocation: null]`.
  * **User Actions**: View Stock Balance table.
  * **Expected Verification Outputs**: Table renders row without crashing; displays fallback strings "-" or "N/A" for null strings; displays "0" or "-5" for numbers; badge logic handles negative minimum stock gracefully without throwing errors.
* **T2.F2.4: Pagination Out-of-Bounds Request**
  * **Objective**: Verify behavior when user forces page parameter beyond maximum pages.
  * **Exact Test Inputs**: Mock `/api/parts?page=5&limit=50` with `total: 10` (only 1 page exists).
  * **User Actions**: Force page state to 5.
  * **Expected Verification Outputs**: Table displays empty state or automatically resets to page 1; pagination text does not display negative or invalid ranges.
* **T2.F2.5: Multi-Filter Combinatorial Exhaustion**
  * **Objective**: Verify combined application of category, status, and search string resulting in zero matches.
  * **Exact Test Inputs**: Select Category "Hardware", Status "Out of Stock", type "Turbine" in search. Mock API returns `[]`.
  * **User Actions**: Apply all three filters simultaneously.
  * **Expected Verification Outputs**: Network request includes `categoryId=...&status=out&search=Turbine`; UI renders clean empty state; pagination resets to page 1.

#### F3: `Issuance` Report
* **T3.F3.1: Empty Items List in Issuance Record**
  * **Objective**: Verify modal behavior when an issuance record has an empty items array.
  * **Exact Test Inputs**: Issuance record with `items: []`.
  * **User Actions**: Click "View" on the issuance row.
  * **Expected Verification Outputs**: Modal opens successfully; items table displays a single row spanning all columns with text "No items found".
* **T3.F3.2: Extreme Quantity Values in Issuance**
  * **Objective**: Verify rendering of extremely large item quantities in the issuance modal.
  * **Exact Test Inputs**: Issuance item with `quantity: 999999999`.
  * **User Actions**: Open issuance detail modal.
  * **Expected Verification Outputs**: Quantity column displays "999999999" (or locale formatted "999,999,999") without layout clipping or text wrapping corruption.
* **T3.F3.3: Missing User and Store Metadata**
  * **Objective**: Verify fallback rendering when `processedByUser` and `storeId` are null.
  * **Exact Test Inputs**: Issuance record with `processedByUser: null, storeId: null`.
  * **User Actions**: Open issuance detail modal.
  * **Expected Verification Outputs**: Modal header/grid displays "Unknown" for Processed By and "-" for Store ID.
* **T3.F3.4: Extremely Long Notes String**
  * **Objective**: Verify modal layout stability when notes contain an extremely long, unspaced string.
  * **Exact Test Inputs**: Issuance record with `notes: "LONGNOTE".repeat(500)`.
  * **User Actions**: Open issuance detail modal.
  * **Expected Verification Outputs**: Notes container applies `break-words` or `overflow-x-auto`; modal does not exceed viewport width; close button remains accessible.
* **T3.F3.5: Simultaneous Modal Open Attempts**
  * **Objective**: Verify that clicking 'View' on multiple rows rapidly does not stack multiple backdrops or lock the UI.
  * **Exact Test Inputs**: Issuance table with multiple rows.
  * **User Actions**: Click "View" on row 1, immediately click "View" on row 2 before modal animation completes.
  * **Expected Verification Outputs**: Only one Dialog modal is mounted and active; backdrop dismisses cleanly on pressing `Escape`.

#### F4: `Receiving` Report
* **T4.F4.1: Broken Receipt Image URL**
  * **Objective**: Verify modal behavior when `imageUrl` points to an invalid or unreachable resource.
  * **Exact Test Inputs**: Receiving record with `imageUrl: "https://invalid-url.local/image.png"`.
  * **User Actions**: Open receiving modal, click "View Receipt".
  * **Expected Verification Outputs**: Link opens in a new tab (`target="_blank"`); parent application remains fully stable and unaffected by external load failure.
* **T4.F4.2: Zero and Negative Unit Prices**
  * **Objective**: Verify formatting of unusual unit price values in receiving items.
  * **Exact Test Inputs**: Receiving items with `unitPrice: "0.00"` and `unitPrice: "-50.00"`.
  * **User Actions**: Open receiving modal.
  * **Expected Verification Outputs**: Table displays "0.00" and "-50.00" exactly as provided without throwing parsing errors or crashing.
* **T4.F4.3: Missing Supplier String**
  * **Objective**: Verify receiving table rendering when supplier name is an empty string or null.
  * **Exact Test Inputs**: Receiving record with `supplier: ""`.
  * **User Actions**: View receiving table.
  * **Expected Verification Outputs**: Supplier column displays "-" or remains blank without corrupting row height or alignment.
* **T4.F4.4: Massive Item List in Receiving Modal**
  * **Objective**: Verify modal scroll behavior when receiving record contains 500 items.
  * **Exact Test Inputs**: Receiving record with 500 items.
  * **User Actions**: Open receiving modal.
  * **Expected Verification Outputs**: Modal container enables internal vertical scrolling (`max-h-[80vh]` or similar overflow property); modal header and close button remain fixed or accessible at the top.
* **T4.F4.5: Print Window Blocked by Browser Popup Blocker**
  * **Objective**: Verify application resilience when `window.open` returns null (popup blocked).
  * **Exact Test Inputs**: Mock `window.open` returning `null`.
  * **User Actions**: Click "Print" button in Receiving CardHeader.
  * **Expected Verification Outputs**: Application does not crash; no null reference exceptions occur in console; gracefully aborts print generation.

#### F5: `Consumable` Report
* **T5.F5.1: Consumable Empty State Representation**
  * **Objective**: Verify complete absence of consumable items triggers the explicit empty state component.
  * **Exact Test Inputs**: Mock `/api/consumable-issuances` returning `{issuances: []}`.
  * **User Actions**: Click "Consumable Items" tab.
  * **Expected Verification Outputs**: DOM mounts the empty state container containing the FileSpreadsheet icon and text "No consumable items found"; table is completely hidden.
* **T5.F5.2: Special Characters in Consumable Item Name**
  * **Objective**: Verify rendering of consumable item names containing complex symbols and HTML entities.
  * **Exact Test Inputs**: Consumable item with `itemName: "<script>alert(1)</script> & '\" | ไท"`.
  * **User Actions**: Open consumable modal.
  * **Expected Verification Outputs**: Text is safely escaped by React; no script execution occurs; Thai characters and symbols render cleanly without corruption.
* **T5.F5.3: Missing Unit Specification**
  * **Objective**: Verify fallback rendering when consumable item lacks a unit string.
  * **Exact Test Inputs**: Consumable item with `unit: null`.
  * **User Actions**: Open consumable modal.
  * **Expected Verification Outputs**: Unit column displays "N/A" or "-".
* **T5.F5.4: Extremely Long Consumable Description**
  * **Objective**: Verify table cell truncation or wrapping for massive description strings.
  * **Exact Test Inputs**: Consumable item with `description: "A".repeat(300)`.
  * **User Actions**: Open consumable modal.
  * **Expected Verification Outputs**: Description cell wraps text or applies ellipsis truncation without blowing out table width.
* **T5.F5.5: API 500 Internal Server Error on Consumable Fetch**
  * **Objective**: Verify UI failure handling when consumable API returns a 500 error.
  * **Exact Test Inputs**: Mock `/api/consumable-issuances` returning 500 Internal Server Error.
  * **User Actions**: Click "Consumable Items" tab.
  * **Expected Verification Outputs**: TanStack Query error state activates; UI displays a clean error boundary or message; does not infinite loop on retries.

#### F6: `MonthlyUsage` Report
* **T6.F6.1: Future Month/Year Selection (Empty Data)**
  * **Objective**: Verify behavior when selecting a future month/year with zero transactions.
  * **Exact Test Inputs**: Select Year "2026", Month "December" (assuming current date is June 2026); mock API returns empty arrays and zero totals.
  * **User Actions**: Change month dropdown to "December".
  * **Expected Verification Outputs**: KPI cards display "0"; BarChart displays empty state "No issuance data for this month"; Usage Ranking table displays "No data for selected period."
* **T6.F6.2: Single Part Dominance (100% Usage Bar)**
  * **Objective**: Verify percentage calculation when only one part exists in the entire monthly usage dataset.
  * **Exact Test Inputs**: Mock `allParts: [{partNo: "SOLO-1", totalQty: 5}]`.
  * **User Actions**: Inspect Usage Ranking table.
  * **Expected Verification Outputs**: Usage bar calculates to exactly 100%; maxQty division handles single item correctly without NaN or infinity errors.
* **T6.F6.3: Division by Zero Prevention in KPI Change Percent**
  * **Objective**: Verify change percentage logic when previous month usage was exactly 0.
  * **Exact Test Inputs**: Mock summary `[totalPartsUsed: 500, prevTotalPartsUsed: 0, changePercent: null]`.
  * **User Actions**: Inspect KPI summary cards.
  * **Expected Verification Outputs**: Card displays "No prior data" or "—" rather than "Infinity%" or "NaN%".
* **T6.F6.4: Massive Spike Count Handling**
  * **Objective**: Verify layout grid performance when 50 different parts trigger abnormal usage spikes simultaneously.
  * **Exact Test Inputs**: Mock `spikes` array containing 50 distinct part spike objects.
  * **User Actions**: View Monthly Usage tab.
  * **Expected Verification Outputs**: Spike alert card renders a responsive grid (`sm:grid-cols-2 lg:grid-cols-3`); all 50 spike boxes render cleanly without breaking parent container padding or overflowing.
* **T6.F6.5: Accordion Multi-Click State Toggle**
  * **Objective**: Verify that clicking an open equipment accordion closes it, and clicking another opens the new one while closing the old.
  * **Exact Test Inputs**: Mock `equipmentBreakdown` with 3 equipments ("EQ-1", "EQ-2", "EQ-3").
  * **User Actions**: Click "EQ-1", then click "EQ-2", then click "EQ-2" again.
  * **Expected Verification Outputs**: Click 1 opens EQ-1 table; Click 2 closes EQ-1 table and opens EQ-2 table; Click 3 closes EQ-2 table, leaving all accordions collapsed.

#### F7: `ReturnToStock` Report
* **T7.F7.1: Zero Return Records Empty State**
  * **Objective**: Verify Return to Stock UI displays clean empty state when no returns exist.
  * **Exact Test Inputs**: Mock `/api/stock-returns` returning `{stockReturns: [], total: 0}`.
  * **User Actions**: Click "Return to Stock" tab.
  * **Expected Verification Outputs**: Table displays empty state row or container with text "No stock returns found"; pagination shows 0 total.
* **T7.F7.2: Unicode & Thai Strings in Return Notes**
  * **Objective**: Verify Return to Stock table supports complex Thai characters and emojis in return notes.
  * **Exact Test Inputs**: Return record with `notes: "คืนคลังเนื่องจากอะไหล่ผิดสเปค 📦🔄"`.
  * **User Actions**: View Return to Stock table.
  * **Expected Verification Outputs**: Thai characters and emojis render perfectly without garbling or question mark replacements.
* **T7.F7.3: Extremely Long Returned By String**
  * **Objective**: Verify table column width stability when `returnedBy` contains an excessively long name.
  * **Exact Test Inputs**: Return record with `returnedBy: "Hubert Blaine Wolfeschlegelsteinhausenbergerdorff Sr."`.
  * **User Actions**: View Return to Stock table.
  * **Expected Verification Outputs**: Returned By column wraps text or applies truncation; table layout does not break horizontal scroll boundaries unexpectedly.
* **T7.F7.4: Rapid Pagination Click Stress Test**
  * **Objective**: Verify TanStack Query cancellation and race condition handling during rapid pagination clicks in Return to Stock.
  * **Exact Test Inputs**: Return to Stock tab active; 10 pages of data available; variable API latency.
  * **User Actions**: Click "Next" 5 times rapidly (<100ms between clicks).
  * **Expected Verification Outputs**: Only the final page request (page 6) completes and renders; earlier in-flight requests are cleanly superseded or cancelled; UI displays correct items for page 6.
* **T7.F7.5: Concurrent Search and Pagination Reset**
  * **Objective**: Verify that entering a search query while on page 3 of Return to Stock correctly resets the page parameter to 1.
  * **Exact Test Inputs**: Active on page 3 of Return to Stock (`page=3`).
  * **User Actions**: Type "Filter" into search box.
  * **Expected Verification Outputs**: Component state `page` resets to 1; network request fires with `page=1&search=Filter`; table displays page 1 of search results.

#### F8: Export Actions & Audit Logging
* **T8.F8.1: Simultaneous Export Click Prevention**
  * **Objective**: Verify that clicking CSV export disables export buttons to prevent duplicate simultaneous processing.
  * **Exact Test Inputs**: Stock Balance tab active; `fetchAllPartsForExport` mocked with 2-second delay.
  * **User Actions**: Click "Export Excel" (CSV), immediately attempt to click "PDF" export button.
  * **Expected Verification Outputs**: PDF button is disabled (`disabled={isExporting}`); only one export operation runs; only one audit event is dispatched.
* **T8.F8.2: Audit Event Dispatch Failure Independence**
  * **Objective**: Verify that a failure or exception in the audit logging dispatch mechanism does not prevent file download.
  * **Exact Test Inputs**: Mock `window.dispatchEvent` or audit logger to throw an explicit Error.
  * **User Actions**: Click "Export Excel" on Stock Balance tab.
  * **Expected Verification Outputs**: Error is caught or handled; CSV Blob is still created and successfully downloaded by the browser.
* **T8.F8.3: Export Data with Embedded Quotes and Commas**
  * **Objective**: Verify CSV escaping logic when part descriptions contain quotes, commas, and newlines.
  * **Exact Test Inputs**: Part description `10", Heavy-Duty, \n "Grade A"`.
  * **User Actions**: Click "Export Excel" on Stock Balance tab.
  * **Expected Verification Outputs**: Downloaded CSV file encloses the field in double quotes and escapes internal quotes (e.g., `"10"", Heavy-Duty, \n ""Grade A"""`); audit event logs successfully.
* **T8.F8.4: Export Empty Dataset Handling**
  * **Objective**: Verify export behavior and audit logging when exporting a report that currently has 0 items.
  * **Exact Test Inputs**: Stock Balance filtered to 0 items; click export.
  * **User Actions**: Click "Export Excel".
  * **Expected Verification Outputs**: CSV file downloads containing only the header row; audit event `export_report` is dispatched with metadata indicating 0 items exported (if supported) or standard export metadata.
* **T8.F8.5: PDF Table AutoTable Overflow Handling**
  * **Objective**: Verify jsPDF autoTable layout when exporting 500 rows with extremely lengthy descriptions.
  * **Exact Test Inputs**: 500 parts with 200-character descriptions.
  * **User Actions**: Click "PDF" export button on Stock Balance tab.
  * **Expected Verification Outputs**: jsPDF autoTable paginates across multiple pages; header repeats on each page; footer correctly calculates total page count (`Page X of Y`); audit event `export_report` is dispatched.

#### F9: Theming
* **T9.F9.1: Missing CSS Variable Fallback**
  * **Objective**: Verify Recharts chart renders without fatal errors if a semantic CSS variable is undefined in the environment.
  * **Exact Test Inputs**: Remove `--recharts-bar-1` definition from stylesheets.
  * **User Actions**: View Monthly Usage bar chart.
  * **Expected Verification Outputs**: Chart container mounts successfully; browser fallback or Recharts default fill is applied without throwing JavaScript errors.
* **T9.F9.2: Dynamic Theme Switching During Modal Display**
  * **Objective**: Verify that toggling dark mode while a detail modal is open dynamically re-themes the open modal.
  * **Exact Test Inputs**: Open Issuance detail modal in light mode.
  * **User Actions**: Toggle document root class to `dark`.
  * **Expected Verification Outputs**: Open modal background transitions immediately from white to dark gray (`dark:bg-gray-800`); text transitions from dark gray to white without requiring modal reload.
* **T9.F9.3: Color Contrast on Custom Scrollbars**
  * **Objective**: Verify custom overflow scrollbars in table containers adhere to dark mode track/thumb colors.
  * **Exact Test Inputs**: Dark mode active; view Stock Balance table with 50 items (overflowing vertically/horizontally).
  * **User Actions**: Inspect scrollbar container styles.
  * **Expected Verification Outputs**: Scrollbar thumb and track apply dark mode custom styles or maintain adequate contrast against dark table backgrounds.
* **T9.F9.4: High Contrast OS Theme Override**
  * **Objective**: Verify UI stability and readability when testing under forced high-contrast browser/OS flags.
  * **Exact Test Inputs**: Emulate CSS `forced-colors: active`.
  * **User Actions**: Inspect buttons, tabs, and table borders.
  * **Expected Verification Outputs**: Semantic border variables and system colors apply cleanly; tab active state remains visually distinguishable via border or outline properties.
* **T9.F9.5: Print Media Theming Override**
  * **Objective**: Verify that generated print documents force a light-mode, printer-friendly color scheme regardless of active dark mode.
  * **Exact Test Inputs**: Dark mode active (`class="dark"` on root).
  * **User Actions**: Click "Print" button on Stock Balance tab.
  * **Expected Verification Outputs**: Written print HTML document explicitly specifies black text on white background (`body { font-family: Arial; background: #fff; color: #000; }`); dark mode utility classes are stripped or overridden in print view.

#### F10: Accessibility (a11y)
* **T10.F10.1: Screen Reader Table Caption / Summary**
  * **Objective**: Verify tables are identifiable to screen readers via appropriate headers or `aria-label` containers.
  * **Exact Test Inputs**: Stock Balance tab active.
  * **User Actions**: Inspect `<Table>` element tree.
  * **Expected Verification Outputs**: Table element is enclosed in a container with `aria-label="Stock Balance Data Table"` or preceded by an accessible title element linked via `aria-labelledby`.
* **T10.F10.2: Dialog Modal Focus Trap**
  * **Objective**: Verify that opening a detail modal traps keyboard focus inside the modal until dismissed.
  * **Exact Test Inputs**: Open Issuance detail modal.
  * **User Actions**: Press `Tab` repeatedly.
  * **Expected Verification Outputs**: Focus cycles through modal interactive elements (close button, internal links/buttons) and does not escape to the background page tabs or search inputs.
* **T10.F10.3: Escape Key Modal Dismissal**
  * **Objective**: Verify that pressing `Escape` closes active detail modals and restores focus to the triggering button.
  * **Exact Test Inputs**: Open Issuance detail modal via keyboard `Enter` on the View button.
  * **User Actions**: Press `Escape`.
  * **Expected Verification Outputs**: Modal unmounts; DOM focus returns precisely to the "View" button of the corresponding table row.
* **T10.F10.4: Search Input Labeling**
  * **Objective**: Verify standalone search input fields have valid accessible labels (`aria-label` or associated `<label>`).
  * **Exact Test Inputs**: Stock Balance tab active.
  * **User Actions**: Inspect search `<Input>` element.
  * **Expected Verification Outputs**: Input element contains `aria-label="Search inventory parts"` or similar explicit labeling beyond just a visual `placeholder`.
* **T10.F10.5: Keyboard Activation of Accordions**
  * **Objective**: Verify equipment breakdown accordions in Monthly Usage can be toggled using `Space` or `Enter`.
  * **Exact Test Inputs**: Monthly Usage tab active.
  * **User Actions**: Press `Tab` to focus the "EQ-1" accordion header button, press `Space`.
  * **Expected Verification Outputs**: Accordion toggles state and expands the sub-table; focus remains cleanly on the accordion header button.

---

## 5. Verification Method

To independently verify the test case design integrity and ensure the application meets the acceptance criteria set in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `SCOPE.md`, the following verification steps must be executed:

### 1. Programmatic & Build Verification Commands
Run the following commands from the root directory (`d:/StockTracker`) or client directory to prove TypeScript compile-time safety and production bundle validity:
```bash
# 1. Verify TypeScript compilation across the entire project without emitting files
tsc --noEmit

# 2. Verify Vite production bundling completes successfully without errors
npm run build
```
* **Invalidation Condition**: Any missing import, mismatched type definition, unresolved JSX block, or Rollup bundling failure instantly invalidates the implementation.

### 2. Files to Inspect
* `client/src/components/reports/reports.tsx`: Ensure it acts cleanly as a parent tab container importing child components.
* `client/src/components/reports/StockBalanceReport.tsx`: Verify presence of `useMemo` on heavy transformations and `useCallback` on export handlers.
* `client/src/components/reports/ReturnToStockReport.tsx`: Verify complete implementation of the stock return JSX table UI.
* `client/src/components/reports/*`: Verify all export handlers invoke `agent.action` / `export_report` audit logging.

### 3. Functional & Opaque-Box Verification
* **Tab Click Verification**: Launch the development server, navigate to `/reports`, click the `return-to-stock-report` tab button. Confirm via browser DOM inspection that the Return to Stock table UI mounts successfully rather than rendering a blank screen or throwing an error.
* **Audit Log Verification**: Open browser developer tools (Console / Network tab). Click any "Export Excel" or "PDF" button. Verify the correct file download initiates and inspect the console/network for the dispatched `export_report` audit event.
* **Accessibility Verification**: Inspect DOM elements to verify the presence of an `<h1>` heading, `aria-label` attributes on icon buttons/tabs/pagination, and verify via CSS inspection tools that empty state text contrast satisfies the `>= 4.5:1` WCAG AA threshold.
