# Handoff Report: Milestone 2 — Receiving & Consumable Reports Extraction Strategy

## 1. Observation

### 1.1 File Structure & Discrepancy
- **Target File Inspection**: `find_by_name` and `view_file` revealed that the parent reports container is located at `d:/StockTracker/client/src/pages/reports.tsx` (2,240 lines), rather than `client/src/components/reports/reports.tsx` as initially referenced in some prompts/project documentation.
- **Components Directory**: `client/src/components/` currently contains UI, layout, modals, and issuance directories, but `client/src/components/reports/` has not yet been populated with sub-report files.

### 1.2 `ReceivingReport` Analysis (Lines 988–1227 in `client/src/pages/reports.tsx`)
- **JSX Boundaries**: The code is wrapped in `activeReport === "receiving-report" && (<Card>...</Card>)`.
- **Hooks & State**:
  - **Pagination State**: `const [page, setPage] = useState(1);` (Line 209). Currently shared across tabs in `reports.tsx`. Note: while `page` is passed to the API fetch (`/api/receivings?page=${page}&limit=50`), the actual table UI at the bottom (Lines 1222–1227) lacks pagination buttons.
  - **i18n Hook**: `const { t, language } = useLanguage();` (Line 212).
  - **Data Query**: Lines 269–277:
    ```typescript
    const { data: receivingData, isLoading: receivingLoading } = useQuery({
      queryKey: ["receivings", { page, report: true }],
      queryFn: async () => {
        const res = await apiRequest(`/api/receivings?page=${page}&limit=50`, "GET");
        if (!res.ok) throw new Error("Failed to fetch receiving data");
        return res.json();
      },
      enabled: activeReport === "receiving-report",
    });
    ```
- **Export & Print Handlers**:
  - Attached to header buttons (Lines 999–1089).
  - **CSV Export**: Maps `receivingData.receivings` to an array of objects (`Receive Number`, `Date`, `Supplier`, `Store ID`, `Invoice`, `Items Count`, `Status`) and invokes `exportToCSV(...)`.
  - **PDF Export**: Maps `receivingData.receivings` to a 2D array of strings and invokes `exportToPDF(...)`.
  - **Print**: Generates an HTML table string and invokes `printReport(...)`.
- **Dialog Details**: Uses `@/components/ui/dialog` to inspect individual receiving records and items.

### 1.3 `ConsumableReport` Analysis (Lines 1230–1449 in `client/src/pages/reports.tsx`)
- **JSX Boundaries**: The code is wrapped in `activeReport === "consumable-report" && (<Card>...</Card>)`.
- **Hooks & State**:
  - **Pagination State**: Shared `page` state (Line 209). Like `ReceivingReport`, `consumable-report` passes `page` to `/api/consumable-issuances` but lacks pagination buttons in the table footer.
  - **i18n Hook**: `useLanguage()`.
  - **Data Query**: Lines 289–297:
    ```typescript
    const { data: consumableIssuancesData, isLoading: consumableIssuancesLoading } = useQuery({
      queryKey: ["consumableIssuances", { page, report: true }],
      queryFn: async () => {
        const res = await apiRequest(`/api/consumable-issuances?page=${page}&limit=50`, "GET");
        if (!res.ok) throw new Error("Failed to fetch consumable issuance data");
        return res.json();
      },
      enabled: activeReport === "consumable-report",
    });
    ```
- **Export & Print Handlers**:
  - **CSV Export** (Lines 1241–1266): Maps `consumableIssuancesData.issuances` to an array of objects (`Issue Number`, `Date`, `Requested By`, `Store ID`, `Items Count`, `Status`, `Notes`) and invokes `exportToCSV`.
  - **Print** (Lines 1267–1307): Builds an HTML table string and invokes `printReport`.
  - **Missing Feature**: `ConsumableReport` currently lacks a PDF export button, which represents an existing feature parity gap.
- **Empty State**: Lines 1436–1446 render a center-aligned div with a `FileSpreadsheet` icon (`text-gray-400`), title (`text-gray-900 dark:text-white`), and description (`text-gray-600 dark:text-gray-400`).

---

## 2. Logic Chain

### 2.1 Component Extraction & Interface Contract
- **Decoupling State**: Since `reports.tsx` currently shares a single `page` state across all sub-reports, extracting `ReceivingReport` and `ConsumableReport` into independent files requires each component to manage its own `const [page, setPage] = useState(1);`. This encapsulates state cleanly and prevents pagination bugs when switching tabs.
- **Single Source of Truth for Export Utilities**: `exportToCSV`, `exportToPDF`, and `printReport` are defined in `reports.tsx`. To preserve DRY principles and avoid duplicating complex export logic (such as jsPDF setup and BOM prepending), `reports.tsx` should pass these utilities down as props.
  ```typescript
  export interface ReceivingReportProps {
    exportToCSV: (data: any[], filename: string, headers: string[]) => void;
    exportToPDF: (title: string, headers: string[], data: any[][]) => void;
    printReport: (title: string, content: string) => void;
  }
  export interface ConsumableReportProps {
    exportToCSV: (data: any[], filename: string, headers: string[]) => void;
    exportToPDF: (title: string, headers: string[], data: any[][]) => void;
    printReport: (title: string, content: string) => void;
  }
  ```

### 2.2 Performance Memoization (`useMemo` & `useCallback`)
- **Preventing Unnecessary Recalculations (`useMemo`)**: Currently, data extraction and transformation occur inline during rendering or button clicks. By memoizing the raw lists and the transformed export datasets, we prevent expensive re-mapping across renders:
  ```typescript
  const receivingsList = useMemo(() => receivingData?.receivings || [], [receivingData]);
  const csvExportData = useMemo(() => receivingsList.map((receiving: any) => ({
    'Receive Number': receiving.receiveNumber,
    'Date': formatBangkokDate(receiving.receiveDate),
    'Supplier': receiving.supplier,
    'Store ID': receiving.storeId || '-',
    'Invoice': receiving.invoiceNumber || '-',
    'Items Count': receiving.items?.length || 0,
    'Status': receiving.status
  })), [receivingsList]);
  ```
- **Stabilizing Event Handlers (`useCallback`)**: Inline arrow functions in `onClick` handlers cause new function references on every render. Wrapping the export handlers in `useCallback` ensures function identity stability:
  ```typescript
  const handleExportCSV = useCallback(() => {
    if (csvExportData.length > 0) {
      window.dispatchEvent(new CustomEvent('agent.action', {
        detail: { action: 'export_report', reportName: 'Receiving Report', format: 'CSV', timestamp: Date.now() }
      }));
      exportToCSV(csvExportData, `receiving-report-${new Date().toISOString().split('T')[0]}.csv`, ['Receive Number', 'Date', 'Supplier', 'Store ID', 'Invoice', 'Items Count', 'Status']);
    }
  }, [csvExportData, exportToCSV]);
  ```

### 2.3 Client-Side Audit Event Dispatching
- **Governance Alignment**: Per `agent-audit-logging` SKILL.md and `PROJECT.md` specifications, agent actions and report exports must produce traceable audit events. Dispatching a standard `CustomEvent('agent.action', { detail: { action: 'export_report', ... } })` enables client-side agent tracing mechanisms to capture export operations without coupling components to a specific backend logging route.

### 2.4 Accessibility (a11y), Contrast Ratios, and Semantic Theming
- **`<h1>` Top-Level Heading**: Replacing `<CardTitle>{t('receivingReport')}</CardTitle>` with `<CardTitle><h1 className="text-2xl font-bold">{t('receivingReport')}</h1></CardTitle>` creates a clear, semantic page structure for screen readers.
- **`aria-label` Attributes**: Adding descriptive `aria-label` attributes to icon buttons (`export`, `print`, `view details`) and pagination controls satisfies WCAG interactive element standards.
- **WCAG AA Contrast Ratios (>= 4.5:1)**: Empty state text currently uses `text-gray-600 dark:text-gray-400`. To ensure compliance with the 4.5:1 contrast requirement against pure white (`#ffffff`) or dark (`#1f2937`) backgrounds, text classes should be adjusted to `text-gray-700 dark:text-gray-300`.
- **Tailwind & Recharts Semantic CSS Variables**: Replace hardcoded generic color classes with Tailwind theme variables (`text-[var(--lion-red-500)]`, `border-[var(--lion-red-500)]`, `text-[var(--primary)]`). Although `ReceivingReport` and `ConsumableReport` do not natively render Recharts graphs, any future chart integrations or styling tokens must reference semantic CSS variables (`var(--primary)`, `var(--lion-red-500)`) rather than hardcoded hex arrays (`#ef4444`).

---

## 3. Caveats

1. **Missing PDF Export in `ConsumableReport`**: The existing monolithic `reports.tsx` lacks a PDF export button for consumable items. Our proposed strategy includes adding `exportToPDF` functionality to `ConsumableReport` to maintain feature parity with other sub-reports.
2. **Missing Pagination UI**: Both existing blocks use `page` in their API requests (`/api/receivings?page=${page}&limit=50`) but lack pagination control buttons in the table footer. The implementation agent should implement standard pagination buttons (matching the Stock Balance report) with appropriate `aria-label` attributes (`aria-label="Previous page"`, `aria-label="Next page"`).
3. **Implicit `any` Types in Map Callbacks**: The existing codebase maps over `receivingData.receivings` using `(receiving: any) => ...`. While this passes `tsc --noEmit` due to existing tsconfig settings, the implementer should maintain or improve these type definitions to prevent regressions.

---

## 4. Conclusion

The monolithic `client/src/pages/reports.tsx` can be cleanly refactored by extracting `ReceivingReport` and `ConsumableReport` into `client/src/components/reports/ReceivingReport.tsx` and `client/src/components/reports/ConsumableReport.tsx`.

### Actionable Implementation Strategy:
1. **Create `client/src/components/reports/ReceivingReport.tsx`**:
   - Define `ReceivingReportProps` accepting `exportToCSV`, `exportToPDF`, and `printReport`.
   - Manage local `const [page, setPage] = useState(1);`.
   - Use `useQuery` to fetch `["receivings", { page, report: true }]`.
   - Implement `useMemo` for `receivingsList`, `csvExportData`, and `pdfExportData`.
   - Implement `useCallback` for `handleExportCSV`, `handleExportPDF`, and `handlePrint`. Inside export handlers, dispatch `window.dispatchEvent(new CustomEvent('agent.action', { detail: { action: 'export_report', ... } }))`.
   - Wrap `CardTitle` text in an `<h1>` element. Add `aria-label` attributes to export, print, view dialog, and pagination buttons.
   - Use Tailwind theme variables `text-[var(--lion-red-500)] border-[var(--lion-red-500)]` for PDF buttons and ensure empty state text uses `text-gray-700 dark:text-gray-300`.

2. **Create `client/src/components/reports/ConsumableReport.tsx`**:
   - Follow the exact same pattern as `ReceivingReport`.
   - Add the missing PDF export button using `exportToPDF` with `useCallback` and audit logging.
   - Ensure the empty state (`noConsumableItems`) satisfies the WCAG AA >= 4.5:1 contrast ratio by using `text-gray-700 dark:text-gray-300`.

3. **Subsequent Integration in `reports.tsx`** (Future Milestone):
   - Import the new components into `client/src/pages/reports.tsx` and replace the inline JSX blocks with `<ReceivingReport exportToCSV={exportToCSV} exportToPDF={exportToPDF} printReport={printReport} />` and `<ConsumableReport exportToCSV={exportToCSV} exportToPDF={exportToPDF} printReport={printReport} />`.

---

## 5. Verification Method

To independently verify the structural integrity, TypeScript correctness, and build success of the extracted components, the implementation agent must execute the following verification steps:

### 5.1 Programmatic Verification
Run the following terminal commands in the root workspace directory (`d:/StockTracker`):
1. **TypeScript Type Checking**:
   ```bash
   tsc --noEmit
   ```
   *Success criteria*: Passes cleanly with zero type errors, missing import errors, or interface contract mismatches.
2. **Production Bundle Build**:
   ```bash
   vite build
   ```
   *Success criteria*: Successfully produces the client bundle without broken imports or syntax errors.

### 5.2 Manual / Inspection Verification
1. Inspect `client/src/components/reports/ReceivingReport.tsx` and `client/src/components/reports/ConsumableReport.tsx` to verify:
   - Presence of `useMemo` for data transformation and `useCallback` for export handlers.
   - Presence of `window.dispatchEvent(new CustomEvent('agent.action', ...))` inside export handlers.
   - Presence of `<h1>` heading inside `CardTitle`.
   - Presence of `aria-label` on all icon and pagination buttons.
   - Contrast ratio compliant text classes (`text-gray-700 dark:text-gray-300`) on empty states.
2. Inspect `client/src/pages/reports.tsx` (when integration is performed in M4) to ensure props are correctly passed and tab switching renders the newly extracted components correctly.
