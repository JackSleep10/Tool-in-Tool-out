# Handoff Report — E2E Testing Tier 3 & Tier 4 Design & TEST_INFRA.md Outline

## 1. Observation
During our read-only investigation of the repository, we directly observed the following specifications, requirements, and existing codebase structures:

- **ORIGINAL_REQUEST.md**:
  - **R1. Component Architecture & Splitting**: Split the monolithic `reports.tsx` (2,240 lines) into dedicated sub-report components within `client/src/components/reports/` (`StockBalanceReport.tsx`, `IssuanceReport.tsx`, `ReceivingReport.tsx`, `ConsumableReport.tsx`, `MonthlyUsageReport.tsx`, `ReturnToStockReport.tsx`). Ensure the missing `ReturnToStockReport` JSX block is fully implemented and rendered correctly when active.
  - **R2. Performance Optimization**: Implement `useMemo` for heavy data transformations/sorting/slicing (`allParts`, `topParts`, `equipmentBreakdown`) and `useCallback` for export handlers (`exportToCSV`, `exportToPDF`).
  - **R3. Governance & Audit Logging**: Integrate client-side audit event dispatching (`agent.action`, `export_report`) when users export reports to CSV or PDF.
  - **R4. Theming & Accessibility (a11y)**: Replace hardcoded Recharts hex colors (`BAR_COLORS`) with semantic CSS variables, replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`), add missing `aria-label` attributes to icon buttons, pagination controls, and tabs, ensure empty states satisfy WCAG AA contrast ratios (>= 4.5:1), and add a clear `<h1>` heading.

- **PROJECT.md**:
  - Defines the data flow where `reports.tsx` acts as the parent tab container managing active tab state and rendering the corresponding sub-report component.
  - Milestone 5 establishes the E2E Testing Track to design and implement an opaque-box E2E test suite (Tiers 1-4) for the reports page and publish `TEST_READY.md`.

- **SCOPE.md**:
  - Mandates a requirement-driven, opaque-box E2E test suite derived from user-facing specs rather than implementation internals.
  - Defines the systematic 4-tier approach: Tier 1 (Feature Coverage >=5 per feature), Tier 2 (Boundary & Corner Cases >=5 per feature), Tier 3 (Cross-Feature Combinations), Tier 4 (Real-World Application Scenarios).

- **Existing Codebase (`client/src/pages/reports.tsx`)**:
  - **Lines 107-117**: Defines state variables `activeReport` (defaulting to `"analytics"`), `search`, `categoryFilter`, `statusFilter`, `selectedYear`, `selectedMonth`, `expandedEq`.
  - **Lines 119-172**: Defines `exportToCSV` and `exportToPDF` functions which create dynamic download links/files but currently lack audit logging dispatch calls.
  - **Lines 214-218**: `useEffect` hook resetting `page` to `1` whenever `search`, `categoryFilter`, `statusFilter`, or `activeReport` changes.
  - **Lines 243-257**: `fetchAllPartsForExport` fetches all filtered records (limit 9999) when exporting Stock Balance data.
  - **Lines 358-401**: Defines `reportTabs` array with 7 tabs (`issuance-report`, `receiving-report`, `return-to-stock-report`, `stock-balance`, `consumable-report`, `monthly-usage`, `analytics`).
  - **Lines 453-2236**: Conditional JSX rendering blocks exist for `stock-balance`, `issuance-report`, `receiving-report`, `consumable-report`, `analytics`, and `monthly-usage`. **Observation Confirmation**: There is no conditional rendering block (`activeReport === "return-to-stock-report"`) in the JSX return statement, confirming the critical bug where selecting "Return to Stock Report" results in a blank screen.

---

## 2. Logic Chain
1. **Connecting Monolithic UI Observations to Sub-Report Architecture**:
   - *Premise*: `reports.tsx` is being refactored into a parent tab container delegating rendering to 6 child components in `client/src/components/reports/`.
   - *Inference*: Tier 3 (Cross-Feature Combinations) test cases must specifically exercise the boundaries between parent tab switching and child component lifecycle/fetching. For example, switching tabs rapidly while background queries are loading, or verifying that active tab changes correctly reset pagination state (per lines 214-218).

2. **Pairwise Combining Filters, Exports, and Audit Logging**:
   - *Premise*: Export actions rely on current filter states (`search`, `categoryFilter`, `statusFilter`, `selectedYear`, `selectedMonth`) and must dispatch `agent.action` with `export_report`.
   - *Inference*: A critical interaction to test in Tier 3 is applying multiple compound filters, triggering an export (CSV or PDF), intercepting the resulting audit log event, and verifying that the audit log payload correctly captures the active report type and export format under filtered conditions.

3. **Verifying the Missing JSX Block Fix under Combined Conditions**:
   - *Premise*: The `return-to-stock-report` tab previously rendered a blank screen. The refactored version must render `ReturnToStockReport.tsx` with full theming, accessibility (`<h1>` heading, `aria-label`s), and export capabilities.
   - *Inference*: Both Tier 3 and Tier 4 must include specific test cases that navigate to `return-to-stock-report`, interact with its search/pagination controls, trigger exports, and assert the presence of valid semantic headings and WCAG AA contrast ratios on empty states.

4. **Synthesizing Real-World User Journeys (Tier 4)**:
   - *Premise*: Tier 4 requires realistic end-to-end user workflows that reflect actual operational usage in an inventory management environment.
   - *Inference*: Real-world users do not interact with isolated features; they perform multi-step tasks. We can construct 5 comprehensive user personas/workflows: a Supervisor conducting monthly audits, an Inventory Manager reconciling low stock and reordering, a Warehouse Clerk verifying shipments, a Compliance Auditor inspecting return logs, and an Accessibility User navigating entirely via keyboard/screen reader.

5. **Structuring TEST_INFRA.md**:
   - *Premise*: `TEST_INFRA.md` must serve as the definitive architectural blueprint for the E2E test suite, adhering to the required 5-part template.
   - *Inference*: By clearly separating Test Philosophy, Feature Inventory, Test Architecture, Real-World Scenarios, and Coverage Thresholds, `TEST_INFRA.md` provides clear guidelines for the Worker agent implementing the test harness and the Reviewer/Auditor agents verifying integrity and coverage.

---

## 3. Caveats
- **Opaque-Box Testing Focus**: All test case designs rely on observable DOM elements, URL parameters, network intercepts (for API responses and `agent.action` audit logs), and visual state changes. We do not inspect internal React state, component instance properties, or `useMemo`/`useCallback` cache allocations directly.
- **Test Framework Independence**: The test case designs and infrastructure outline are structured to be implementable in any modern E2E testing framework (such as Playwright or Cypress) chosen by Explorer 1 (`teamwork_preview_explorer_e2e_testing_1`).
- **No File Modifications**: In strict adherence to our read-only explorer mandate, no application source code, configuration files, or test scripts were modified during this exploration.

---

## 4. Conclusion

### A. Tier 3 Test Case Design (Cross-Feature Combinations)
Tier 3 ensures robust pairwise coverage of major feature interactions across the inventory reports page.

| Test ID | Primary Feature | Secondary Feature | Test Setup & User Actions | Expected Observable Result / Verification |
|---|---|---|---|---|
| **T3-01** | Tab Navigation | Compound Filtering | 1. Open Reports page (default Analytics).<br>2. Switch to `stock-balance` tab.<br>3. Select category filter "Category A" and status filter "Low Stock".<br>4. Enter search query "Bolt". | Table updates to show only items matching all 3 criteria. Filter controls remain visible and active with correct selected values. |
| **T3-02** | Compound Filtering | CSV Export & Audit Log | 1. Starting from T3-01 state.<br>2. Click `Export Excel` button.<br>3. Intercept window download and `agent.action` event dispatch. | CSV download initiates containing only filtered records. An audit event `agent.action` is dispatched with action `export_report`, format `csv`, and report `stock-balance`. |
| **T3-03** | Tab Navigation | Pagination Reset | 1. Open `stock-balance` tab.<br>2. Click `Next Page` to reach Page 2.<br>3. Switch to `issuance-report` tab.<br>4. Switch back to `stock-balance` tab. | Verification of pagination summary text confirms `stock-balance` has correctly reset to Page 1 upon active report switching (per `useEffect` contract). |
| **T3-04** | Search Filtering | Pagination Reset | 1. Open `receiving-report` tab.<br>2. Click `Next Page` to reach Page 2.<br>3. Enter search query "Supplier X" into search input. | Table updates with search results and pagination summary text confirms automatic reset to Page 1. |
| **T3-05** | Monthly Filters | PDF Export & Audit Log | 1. Switch to `monthly-usage` tab.<br>2. Select Month "March" and Year "2025".<br>3. Click `PDF` export button.<br>4. Intercept `agent.action`. | PDF download initiates with title "Monthly Usage Report — March 2025". Audit event `agent.action` is dispatched with `export_report`, format `pdf`, and report `monthly-usage`. |
| **T3-06** | Tab Navigation | `ReturnToStock` Rendering | 1. Open Reports page.<br>2. Click `return-to-stock-report` tab button.<br>3. Inspect DOM for table elements and headings. | The Return to Stock Report UI renders successfully (confirming resolution of the missing JSX block bug). A clear `<h1>` heading is present. |
| **T3-07** | Modal Dialog | Background Tab State | 1. Open `issuance-report` tab.<br>2. Click `View` button on the first row to open details modal.<br>3. Inspect modal content and background container. | Details modal opens displaying full issuance information. Background tab container remains stable on `issuance-report` without unmounting or re-rendering. |
| **T3-08** | Theming & a11y | Empty State Rendering | 1. Open `consumable-report` tab.<br>2. Mock API to return empty issuances list (`[]`).<br>3. Inspect empty state container for contrast and headings. | Empty state renders with `<h1>` heading. Computed CSS styles on text and background verify WCAG AA contrast ratio >= 4.5:1. Semantic Tailwind theme variables are active. |
| **T3-09** | Equipment Breakdown | Recharts CSS Variables | 1. Open `monthly-usage` tab.<br>2. Click an equipment row (EQ.NO) to expand its parts table.<br>3. Inspect Recharts BarChart DOM elements. | Equipment row expands showing sorted part list. Inspection of BarChart SVG elements confirms `fill` attributes utilize semantic CSS variables instead of hardcoded hex values. |
| **T3-10** | Tab Navigation | `aria-label` Attributes | 1. Iterate through all 7 report tab buttons.<br>2. Inspect each tab button, pagination control, and export icon button for `aria-label`. | Every tab button, pagination button (`Previous`, `Next`), and export button (`Excel`, `PDF`, `Print`) possesses a valid, descriptive `aria-label` attribute. |

---

### B. Tier 4 Test Case Design (Real-World Application Scenarios)
Tier 4 verifies realistic end-to-end user workflows, simulating multi-step operational tasks performed by various warehouse and management personas.

#### Scenario 1: The Supervisor Monthly Audit Workflow (`T4-01`)
- **Persona**: Warehouse Supervisor responsible for monthly consumption audits and compliance reporting.
- **Step-by-Step Workflow**:
  1. Navigate to the Reports & Analytics page.
  2. Click the `monthly-usage` tab button.
  3. Use the Select dropdowns to adjust the reporting period to "May" and "2026".
  4. Inspect the Overview KPI cards (Total Parts Used, Total Issuances, Unique Part Nos, Equipment Covered) to ensure data aggregation is correct.
  5. Check the "Abnormal Usage Detected" spike alert box to identify any part numbers with significant consumption increases.
  6. Click on the top equipment row in the "Usage by Equipment (EQ.NO)" table to expand and review the specific parts consumed by that equipment.
  7. Click the `PDF` export button to generate the monthly compliance document.
- **Expected Verification Points**:
  - All KPI cards and spike alerts render correctly without errors.
  - Expanding the equipment row smoothly displays the nested parts table.
  - PDF export triggers successfully and dispatches the `agent.action` audit log event (`export_report`, `pdf`, `monthly-usage`).

#### Scenario 2: The Inventory Manager Stock Reconciliation & Reorder Workflow (`T4-02`)
- **Persona**: Inventory Manager tasked with preventing stockouts and preparing reorder lists for purchasing.
- **Step-by-Step Workflow**:
  1. Open the Reports page (lands on default `analytics` tab).
  2. Inspect the "Stock Alerts" section for Low Stock (yellow warning) and Out of Stock (red critical) notifications.
  3. Click the `stock-balance` tab button to view detailed inventory levels.
  4. Select "Low Stock" from the stock level status dropdown filter.
  5. Select a specific category (e.g., "Filters & Lubricants") from the category dropdown filter.
  6. Review the filtered table to ensure all displayed rows have a `Low Stock` badge.
  7. Click the `Export Excel` button to generate a CSV file for the purchasing department.
- **Expected Verification Points**:
  - Analytics tab correctly aggregates low/out-of-stock counts.
  - Switching to `stock-balance` displays the full stock table.
  - Applying category and status filters instantly narrows the table rows to matching items.
  - `Export Excel` initiates a CSV download containing all matching items and dispatches the `agent.action` audit log event (`export_report`, `csv`, `stock-balance`).

#### Scenario 3: The Warehouse Clerk Receiving & Verification Workflow (`T4-03`)
- **Persona**: Warehouse Clerk verifying recent supplier shipments against physical invoices and checking consumable inventory.
- **Step-by-Step Workflow**:
  1. Navigate to the Reports page and click the `receiving-report` tab button.
  2. Enter a supplier name (e.g., "Global Parts Co") into the search input box.
  3. Locate the specific receiving transaction row and click the `View` icon button to open the details modal.
  4. Verify the receive date, supplier name, store ID, invoice number, and individual item quantities/bin locations within the modal.
  5. Close the modal dialog.
  6. Click the `Print` button to open the print summary view.
  7. Switch to the `consumable-report` tab to verify that corresponding consumable items were correctly logged.
- **Expected Verification Points**:
  - Search filtering correctly isolates the supplier's receiving records.
  - The details modal opens and displays complete, formatted receiving information.
  - Closing the modal returns focus to the underlying tab without losing search filter state.
  - `Print` action successfully invokes the window print formatting logic.
  - Switching to `consumable-report` loads consumable records smoothly.

#### Scenario 4: The Compliance Auditor Return-to-Stock Inspection Workflow (`T4-04`)
- **Persona**: External Compliance Auditor verifying return-to-stock tracking integrity and system UI compliance.
- **Step-by-Step Workflow**:
  1. Navigate to the Reports page and click the `return-to-stock-report` tab button.
  2. Verify that the table UI loads successfully and displays return records (directly verifying the missing JSX block fix).
  3. Inspect the page heading to verify the presence of a top-level `<h1>` semantic tag.
  4. Use the pagination controls to navigate to Page 2, verifying the pagination summary text updates correctly.
  5. Click the `PDF` export button to download the return history for audit archiving.
  6. Intercept and verify the client-side audit event dispatch.
- **Expected Verification Points**:
  - The `return-to-stock-report` tab renders a complete table (no blank screen).
  - An `<h1>` element is present containing the report title.
  - Pagination works seamlessly, updating table rows and summary text.
  - PDF export succeeds and dispatches `agent.action` (`export_report`, `pdf`, `return-to-stock-report`).

#### Scenario 5: The Accessibility & Keyboard Navigation Workflow (`T4-05`)
- **Persona**: A warehouse staff member relying entirely on keyboard navigation and assistive screen reading technologies.
- **Step-by-Step Workflow**:
  1. Load the Reports page and press `Tab` to navigate focus to the report navigation card.
  2. Use `Tab` and `Arrow` keys to move focus through the 7 report tab buttons, verifying `aria-label` attributes on each.
  3. Press `Enter` or `Space` while focused on the `issuance-report` tab button to activate it.
  4. Press `Tab` to move focus into the table rows and reach the `View` button on the first row; verify its `aria-label`.
  5. Press `Enter` to open the details modal dialog.
  6. Press `Escape` to close the modal dialog.
  7. Press `Tab` to move focus to the `Export Excel` button and verify its `aria-label`.
- **Expected Verification Points**:
  - All interactive elements (tabs, table buttons, export buttons, pagination controls) are fully reachable via keyboard `Tab` navigation.
  - Every interactive element possesses a valid, descriptive `aria-label`.
  - Modal dialog opens on `Enter`, traps focus correctly, and closes cleanly on `Escape`.
  - All text elements and badges satisfy WCAG AA contrast ratios (>= 4.5:1).

---

### C. Complete Outline and Structure for TEST_INFRA.md
Below is the definitive architectural outline and section structure for `TEST_INFRA.md`, adhering strictly to the required template.

```markdown
# TEST_INFRA.md — StockTracker E2E Testing Infrastructure & Architecture

## 1. Test Philosophy
- **Requirement-Driven & Opaque-Box Focus**: The E2E test suite derives entirely from user-facing specifications (`ORIGINAL_REQUEST.md`) and global architecture contracts (`PROJECT.md`). It treats the application as an opaque box, interacting exclusively through observable DOM elements, URL parameters, and public browser APIs without coupling to internal component state or implementation specifics.
- **High-Fidelity Simulation**: Tests execute against fully bundled production or high-fidelity development builds, simulating realistic user journeys, network conditions, and browser events.
- **Strict Isolation & Traceability**: Each test executes in an isolated browser context. Audit logging verification is treated as a first-class citizen, using event interception to ensure robust governance traceability.

## 2. Feature Inventory
A comprehensive mapping of all observable features and contracts within the inventory reports module (`client/src/components/reports/`):
- **Parent Container (`reports.tsx`)**: Manages active tab state, tab navigation bar, and automatic pagination resets on tab change.
- **Sub-Report Components**:
  1. `StockBalanceReport.tsx`: Displays inventory balances, status badges, compound filters (category, status, search), and pagination.
  2. `IssuanceReport.tsx`: Displays parts issuance history, item counts, and detailed view modal dialogs.
  3. `ReceivingReport.tsx`: Displays receiving records, supplier tracking, invoice details, and receipt links.
  4. `ConsumableReport.tsx`: Displays consumable items issuance, unit tracking, and empty state handling.
  5. `MonthlyUsageReport.tsx`: Displays monthly consumption summaries, KPI cards, abnormal usage spike alerts, top parts bar charts (Recharts), and equipment (EQ.NO) breakdowns.
  6. `ReturnToStockReport.tsx`: Displays return-to-stock history, resolving the legacy missing JSX block bug.
- **Export & Governance Actions**: `Export Excel` (CSV), `PDF`, and `Print` functionalities across all sub-reports, mandating client-side audit event dispatching (`agent.action`, `export_report`).
- **Theming & Accessibility (a11y)**: WCAG AA contrast ratios (>= 4.5:1), semantic CSS variables for Recharts, Tailwind theme variables (`--lion-red-500`, `--primary`), `<h1>` header hierarchy, and comprehensive `aria-label` attributes.

## 3. Test Architecture
- **Harness & Runner Setup**: Configured using a modern E2E testing framework (e.g., Playwright/Cypress) operating against the local Vite dev server or preview build.
- **Directory & File Structure**:
  ```
  client/e2e/
  ├── config/             # Test runner configurations and environment setups
  ├── fixtures/           # Mock data payloads for API responses and error states
  ├── support/            # Custom commands, audit log interceptors, and a11y helpers
  └── specs/
      ├── tier1_features.spec.ts    # Tier 1: Core feature verification (>=5 per feature)
      ├── tier2_boundaries.spec.ts  # Tier 2: Boundary & corner cases (>=5 per feature)
      ├── tier3_combinations.spec.ts# Tier 3: Cross-feature combinations (10 test cases)
      └── tier4_workflows.spec.ts   # Tier 4: Real-world application scenarios (5 workflows)
  ```
- **Interception & Mocking Strategy**:
  - **Network Intercepts**: Route handlers intercept `/api/parts`, `/api/issuances`, `/api/receivings`, `/api/stock-returns`, `/api/consumable-issuances`, and `/api/reports/monthly-usage` to provide deterministic test data and simulate edge/empty states.
  - **Audit Event Interception**: A custom window listener or event spy captures custom events (`agent.action`) dispatched during export operations to verify audit logging compliance without requiring backend log aggregation.

## 4. Real-World Scenarios
Maps directly to the 5 realistic operational workflows established in Tier 4:
1. **The Supervisor Monthly Audit Workflow**: Validates date filtering, KPI aggregations, spike alerts, equipment breakdown expansion, and monthly PDF export.
2. **The Inventory Manager Stock Reconciliation & Reorder Workflow**: Validates dashboard stock alerts, switching to stock balance, applying compound category/status filters, and exporting CSV reorder lists.
3. **The Warehouse Clerk Receiving & Verification Workflow**: Validates supplier searching, inspecting receiving details modals, printing summaries, and verifying consumable logs.
4. **The Compliance Auditor Return-to-Stock Inspection Workflow**: Validates the newly implemented `ReturnToStockReport` JSX block, `<h1>` heading presence, pagination traversal, and audit log dispatch on PDF export.
5. **The Accessibility & Keyboard Navigation Workflow**: Validates 100% keyboard reachability (`Tab`/`Arrow`/`Enter`), descriptive `aria-label` assertions, focus trapping in modals, and WCAG AA contrast compliance.

## 5. Coverage Thresholds
To satisfy project acceptance criteria and pass audit gates, the E2E test suite enforces the following quantitative thresholds:
- **Tier 1 (Feature Coverage)**: Minimum of 5 test cases per identified feature in the Feature Inventory (e.g., 5 tests for Stock Balance, 5 for Issuance, 5 for Receiving, 5 for Consumables, 5 for Monthly Usage, 5 for Return to Stock, 5 for Exports, 5 for Theming/a11y).
- **Tier 2 (Boundary & Corner Cases)**: Minimum of 5 test cases per feature covering edge conditions (e.g., empty arrays, extreme pagination, null fields, invalid search strings, zero stock levels, missing relationships).
- **Tier 3 (Cross-Feature Combinations)**: 100% execution of the 10 pairwise combination test cases defined in the Tier 3 design matrix.
- **Tier 4 (Real-World Application Scenarios)**: 100% execution of the 5 multi-step end-to-end user workflows.
- **Quality & Gate Verification**: All test suites must achieve a 100% pass rate with zero flaky tests, complete TypeScript type safety (`tsc --noEmit`), and clean production bundling (`vite build`) prior to publishing `TEST_READY.md`.
```

---

## 5. Verification Method

### How to Independently Verify
1. **Verify Handoff & Outline Delivery**:
   - Inspect `d:/StockTracker/.agents/teamwork_preview_explorer_e2e_testing_3/handoff.md` to confirm the presence of all 5 required sections, the Tier 3 design table, the Tier 4 scenario descriptions, and the complete `TEST_INFRA.md` outline.
2. **Verify Alignment with Codebase & Specs**:
   - Run `view_file` on `d:/StockTracker/ORIGINAL_REQUEST.md`, `PROJECT.md`, and `client/src/pages/reports.tsx` to verify that the test cases accurately reflect the required sub-report splitting, memoization goals, export audit logs (`agent.action`, `export_report`), and accessibility standards (`<h1>`, `aria-label`, WCAG AA contrast).
3. **Future Execution Verification**:
   - Once the Worker agent implements the test harness and sub-report components, verify execution via the project test command (e.g., `npx playwright test` or `npm run test:e2e`).
   - Verify TypeScript compilation and build quality using `npm run check` (`tsc --noEmit`) and `npm run build` (`vite build`).

### Invalidation Conditions
- **Feature Renaming**: If the sub-report component filenames or report tab IDs in `reports.tsx` are modified (e.g., changing `return-to-stock-report` to `stock-returns-tab`), the test case selectors and expected URL/state parameters must be updated accordingly.
- **Audit Event Contract Change**: If the audit log event name is changed from `agent.action` or `export_report` to another format, the event interception assertions in Tiers 3 and 4 must be updated to match the new contract.
