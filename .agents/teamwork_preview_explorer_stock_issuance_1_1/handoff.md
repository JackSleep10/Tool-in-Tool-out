# Handoff Report: StockBalanceReport & IssuanceReport Investigation and Refactoring Strategy

## 1. Observation
We conducted a read-only investigation of `client/src/pages/reports.tsx`, `SCOPE.md`, `PROJECT.md`, `ORIGINAL_REQUEST.md`, `agent-audit-logging/SKILL.md`, `client/src/lib/queryClient.ts`, `server/routes.ts`, and `shared/schema.ts`.

### Directly Observed Code Blocks in `client/src/pages/reports.tsx`
1. **`StockBalanceReport` Section (Lines 453-762)**:
   - **Outer Condition & Container**: Renders when `activeReport === "stock-balance"`. Wraps content in `<Card>`.
   - **State Used**:
     - `search` (line 109): `const [search, setSearch] = useState("");`
     - `categoryFilter` (line 110): `const [categoryFilter, setCategoryFilter] = useState("");`
     - `statusFilter` (line 208): `const [statusFilter, setStatusFilter] = useState("");`
     - `page` (line 209): `const [page, setPage] = useState(1);`
     - `isExporting` (line 210): `const [isExporting, setIsExporting] = useState(false);`
     - `pageSize` (line 211): `const pageSize = 50;`
   - **Effects**:
     - `useEffect` (lines 215-217): Resets `page` to 1 whenever `search`, `categoryFilter`, `statusFilter`, or `activeReport` changes.
   - **Queries & Data Fetching**:
     - `categories` query (lines 219-222): `apiRequest('/api/categories', 'GET')`.
     - `partsData` query (lines 224-240): Fetches `/api/parts?page=1&limit=50&search=&categoryId=&status=`. Enabled when `activeReport === "stock-balance"`.
     - `fetchAllPartsForExport` helper (lines 242-257): Fetches `/api/parts?page=1&limit=9999` with current filters for export buttons. Sets `isExporting` state during fetch.
     - `dashboardStats` query (lines 311-315): Fetches `/api/dashboard/stats`, used to calculate `stockCounts`.
   - **Local Helper Functions**:
     - `getStockStatus(currentStock, minimumStock)` (lines 335-343): Returns `{ label, className }`.
     - `getStockCounts()` (lines 345-354): Calculates `{ normal, low, out, total }` from `dashboardStats`. Called on line 356: `const stockCounts = getStockCounts();`.
   - **Export Button Handlers**:
     - **Export to Excel (CSV)** (lines 465-495): Calls `fetchAllPartsForExport()`, maps `allParts` to an array of objects, and executes `exportToCSV`.
     - **Export to PDF** (lines 498-525): Calls `fetchAllPartsForExport()`, maps `allParts` to `headers` and `rows`, and executes `exportToPDF`.
     - **Print** (lines 527-590): Calls `fetchAllPartsForExport()`, builds HTML strings (`summaryHtml`, `tableHtml`), and executes `printReport`.
   - **UI Components & Elements**:
     - Header & Title (lines 455-463): `<CardTitle>{t('stockBalanceReportName')}</CardTitle>`.
     - Filters UI (lines 595-625): Category select, status select, and search input.
     - Stock Summary Cards (lines 629-686): 4 cards showing Normal Stock, Low Stock, Out of Stock, and Total Parts.
     - Stock Table (lines 689-729): Renders `partsData?.parts`.
     - Pagination (lines 732-759): Shows current range and Next/Previous buttons.

2. **`IssuanceReport` Section (Lines 764-985)**:
   - **Outer Condition & Container**: Renders when `activeReport === "issuance-report"`. Wraps content in `<Card>`.
   - **Queries & Data Fetching**:
     - `issuanceData` query (lines 259-267): Fetches `/api/issuances?limit=0`. Enabled when `activeReport === "issuance-report"`.
   - **Export Button Handlers**:
     - **Export to Excel (CSV)** (lines 776-800): Maps `issuanceData?.issuances` to objects, calls `exportToCSV`.
     - **Export to PDF** (lines 801-822): Maps `issuanceData?.issuances` to arrays, calls `exportToPDF`.
     - **Print** (lines 823-861): Maps `issuanceData?.issuances` to HTML table string, calls `printReport`.
   - **UI Components & Elements**:
     - Header & Title (lines 767-774): `<CardTitle>{t('issuanceReport')}</CardTitle>`.
     - Issuance Table (lines 867-981): Renders `issuanceData?.issuances`.
     - View Details Dialog (lines 894-976): Dialog trigger `<Button variant="outline" size="sm"><Eye className="mr-1 h-4 w-4" />{t('view')}</Button>` and modal displaying issuance metadata, notes, and items table.

3. **Shared Utility Functions & Imports in `reports.tsx`**:
   - `exportToCSV` (lines 119-139): Creates Blob with UTF-8 BOM (`\uFEFF`), triggers download via temporary `<a>` element.
   - `exportToPDF` (lines 141-171): Uses `jsPDF` and `autoTable` to generate a multi-page styled PDF document.
   - `printReport` (lines 173-207): Opens a new window, writes styled HTML, and triggers `window.print()`.
   - Datetime formatters: `formatBangkokDate`, `formatBangkokDateTime` from `@/lib/datetime`.
   - i18n hook: `const { t, language } = useLanguage();` (line 212).

### Architectural & Standards Documentation Findings
- **`SCOPE.md` & `PROJECT.md` & `ORIGINAL_REQUEST.md`**:
  - Components must be extracted into `client/src/components/reports/StockBalanceReport.tsx` and `client/src/components/reports/IssuanceReport.tsx`.
  - `useMemo` must be implemented for heavy data transformations, sorting, and slicing.
  - `useCallback` must be implemented for export handlers (`exportToCSV`, `exportToPDF`).
  - Export actions must dispatch client-side audit events (`agent.action`, `export_report`).
  - All UI components must adhere to WCAG AA contrast ratios (>= 4.5:1) for empty states, semantic CSS variables for Recharts colors, Tailwind theme variables (`--lion-red-500`, `--primary`), and include `aria-label` attributes for accessibility.
  - Clear `<h1>` headings must be used.
- **`agent-audit-logging/SKILL.md`**:
  - Defines structured audit events (`AuditEvent`) and event types to ensure complete traceability.
- **`shared/schema.ts`**:
  - `auditLogs` table tracks system activity with fields: `userId`, `action`, `tableName`, `recordId`, `oldValues`, `newValues`, `ipAddress`, `userAgent`, `createdAt`.

---

## 2. Logic Chain
To create clean, modular, and optimized standalone components that fulfill all architectural, performance, governance, and accessibility requirements without breaking existing functionality, we derive the following step-by-step refactoring strategy:

### A. Component Architecture & Isolation
- **`StockBalanceReport.tsx`**:
  - Should encapsulate its own state (`search`, `categoryFilter`, `statusFilter`, `page`, `isExporting`), its own `useEffect` for page reset, and its own TanStack queries (`categories`, `partsData`, `dashboardStats`).
  - By moving `dashboardStats` query and `fetchAllPartsForExport` into `StockBalanceReport`, the component becomes 100% self-contained, eliminating unnecessary prop drilling from `reports.tsx`.
- **`IssuanceReport.tsx`**:
  - Should encapsulate the `issuanceData` query (`/api/issuances?limit=0`), making it perfectly decoupled and self-contained.

### B. Performance Optimization (`useMemo` & `useCallback`)
- **`useMemo` Strategy**:
  - In `StockBalanceReport.tsx`, `const stockCounts = useMemo(() => getStockCounts(dashboardStats), [dashboardStats]);` avoids re-calculating counts on every render (e.g., when `search` or `page` changes).
  - In `StockBalanceReport.tsx`, memoize the parts list: `const partsList = useMemo(() => partsData?.parts || [], [partsData]);`.
  - In `IssuanceReport.tsx`, memoize the issuances list: `const issuancesList = useMemo(() => issuanceData?.issuances || [], [issuanceData]);`.
- **`useCallback` Strategy**:
  - Wrap the base utility functions `exportToCSV`, `exportToPDF`, and `printReport` with `useCallback`.
  - Wrap the button click handlers (`handleExportCSV`, `handleExportPDF`, `handlePrint`) with `useCallback` to maintain stable function references across re-renders.

### C. Governance & Audit Logging (`agent.action`, `export_report`)
- When a user clicks export to CSV or PDF, we must establish verifiable audit traceability.
- **Client-Side Custom Event Dispatch**:
  ```typescript
  const dispatchAuditEvent = useCallback((action: string, details: any) => {
    // Dispatch custom DOM event for client-side agent listeners
    const event = new CustomEvent('agent.action', {
      detail: {
        event_type: 'agent.tool_call',
        action: `export_report:${action}`,
        timestamp: Date.now(),
        params: details
      }
    });
    window.dispatchEvent(event);

    // Also dispatch via API if backend audit log recording is supported/desired
    try {
      apiRequest('/api/audit-logs', 'POST', {
        action: 'EXPORT_REPORT',
        tableName: details.tableName || 'reports',
        newValues: { reportName: details.reportName, format: details.format, timestamp: new Date().toISOString() }
      }).catch(() => {}); // catch silently if endpoint is not exposed to regular users
    } catch (e) {}
  }, []);
  ```
- Invoke `dispatchAuditEvent('export_report', { reportName: 'Stock Balance Report', format: 'CSV', tableName: 'parts' })` inside `handleExportCSV` and `handleExportPDF`.

### D. Theming, Accessibility (a11y), and WCAG AA Compliance
- **Clear `<h1>` Heading**:
  - Replace `<CardTitle>{t('stockBalanceReportName')}</CardTitle>` with:
    ```tsx
    <CardTitle asChild>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('stockBalanceReportName')}
      </h1>
    </CardTitle>
    ```
  - Apply the same pattern to `IssuanceReport.tsx`.
- **Tailwind Theme Variables (`--lion-red-500`, `--primary`) & Semantic Colors**:
  - Use `text-[var(--lion-red-500)]` or `text-primary`, `border-[var(--lion-red-500)]`, `hover:bg-[var(--lion-red-500)]/10` in place of hardcoded Tailwind classes like `text-red-600 border-red-600 hover:bg-red-50`.
  - For Recharts (where applicable in related analytics), use `var(--lion-red-500)` or `var(--primary)` instead of hardcoded hex values.
- **`aria-label` Attributes**:
  - Add explicit `aria-label` attributes to all interactive icon buttons, select inputs, and pagination controls:
    - Export CSV button: `aria-label="Export Stock Balance Report to CSV"`
    - Export PDF button: `aria-label="Export Stock Balance Report to PDF"`
    - Print button: `aria-label="Print Stock Balance Report"`
    - Category Select: `aria-label="Filter by category"`
    - Status Select: `aria-label="Filter by stock status"`
    - Search Input: `aria-label="Search parts by part number or description"`
    - Pagination Previous: `aria-label="Go to previous page"`
    - Pagination Next: `aria-label="Go to next page"`
    - View Details Dialog trigger: `aria-label={\`View issuance details for \${issuance.issueNumber}\`}`
- **WCAG AA Contrast Ratios (>= 4.5:1) for Empty States**:
  - Existing empty states (e.g., inside the issuance details dialog items table) use `text-gray-500` (`#6b7280`). To guarantee a contrast ratio >= 4.5:1 on light/dark backgrounds, use `text-gray-700 dark:text-gray-300` or `text-gray-600 dark:text-gray-300`.
  - Add explicit empty states for the main Stock Balance table and Issuance table when data is empty:
    ```tsx
    {partsList.length === 0 && (
      <div className="text-center py-12 text-gray-700 dark:text-gray-300 font-medium">
        {t('noItemsFound')}
      </div>
    )}
    ```

---

## 3. Caveats
- **Read-Only Constraint**: As an exploration agent, we have not created or modified any `.tsx` files. The recommendations must be implemented by a subsequent implementing agent or developer.
- **Backend Audit Log Endpoint**: Currently, `server/routes.ts` does not define an explicit `app.post("/api/audit-logs")` route. Therefore, our strategy incorporates both `window.dispatchEvent(new CustomEvent('agent.action', ...))` (which fully satisfies the client-side event dispatching requirement) and a non-blocking `apiRequest` call that gracefully catches errors.
- **Active Tab Delegation**: In this milestone (M1.1), `reports.tsx` is not modified. The extracted components must be exported cleanly as default/named exports so that Milestone 4 can import and render them seamlessly.

---

## 4. Conclusion
The investigation is fully complete. The exact boundaries, state, helper functions, queries, export logic, and UI components for `StockBalanceReport` and `IssuanceReport` have been mapped out.

### Summary of Extraction Specifications

| Component | Target File Path | Encapsulated Queries | Key Memoizations (`useMemo`) | Memoized Handlers (`useCallback`) | Audit Events & a11y Additions |
|---|---|---|---|---|---|
| `StockBalanceReport` | `client/src/components/reports/StockBalanceReport.tsx` | `categories`, `partsData`, `dashboardStats`, `fetchAllPartsForExport` | `stockCounts`, `partsList` | `exportToCSV`, `exportToPDF`, `printReport`, `handleExportCSV`, `handleExportPDF`, `handlePrint` | `agent.action` on export, `<h1>` title, `aria-label` on filters/export/pagination, `text-gray-700` empty state |
| `IssuanceReport` | `client/src/components/reports/IssuanceReport.tsx` | `issuanceData` | `issuancesList` | `exportToCSV`, `exportToPDF`, `printReport`, `handleExportCSV`, `handleExportPDF`, `handlePrint` | `agent.action` on export, `<h1>` title, `aria-label` on export/dialog triggers, `text-gray-700` empty state |

These component files are ready to be created by the implementing agent in Milestone 1.2.

---

## 5. Verification Method
To independently verify the success of the upcoming implementation (Milestone 1.2), the following steps and commands must be executed:

### A. Programmatic Verification (TypeScript & Build Quality)
1. **TypeScript Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected outcome*: Passes cleanly across the entire client project without any missing imports, unused variables, or type mismatches.
2. **Vite Production Build**:
   ```bash
   npx vite build
   ```
   *Expected outcome*: Successfully produces a valid production bundle without any bundling or resolution errors.

### B. Code & Artifact Inspection
1. **Verify File Existence**:
   - Inspect `client/src/components/reports/StockBalanceReport.tsx`.
   - Inspect `client/src/components/reports/IssuanceReport.tsx`.
2. **Verify Memoization & Handlers**:
   - Confirm `useMemo` is used for `stockCounts`, `partsList`, and `issuancesList`.
   - Confirm `useCallback` is used for `exportToCSV`, `exportToPDF`, `printReport`, and button click handlers.
3. **Verify Governance & Accessibility**:
   - Confirm `window.dispatchEvent(new CustomEvent('agent.action', ...))` is present in export handlers.
   - Confirm `<h1 className="...">{...}</h1>` is present in both components.
   - Confirm `aria-label` attributes are present on all export buttons, select filters, pagination buttons, and dialog trigger buttons.
   - Confirm empty states utilize `text-gray-700 dark:text-gray-300` (or `text-gray-600 dark:text-gray-300`) to ensure WCAG AA contrast ratio compliance (>= 4.5:1).
