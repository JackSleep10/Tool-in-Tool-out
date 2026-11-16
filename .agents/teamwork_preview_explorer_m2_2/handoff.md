# Handoff Report: Milestone 2 — Receiving & Consumable Reports Extraction Strategy

## 1. Observation
During our read-only investigation of the StockTracker workspace, we examined the existing codebase, architecture documentation, and skill specifications. Below are the verified observations, direct quotes, and exact file locations:

### 1.1 Documented Scope & Architecture
- **`d:/StockTracker/.agents/sub_orch_receiving_consumable_1/SCOPE.md`**:
  - *Quote (Lines 4-8)*: "Extract `ReceivingReport` and `ConsumableReport` components from `client/src/components/reports/reports.tsx` into dedicated files `client/src/components/reports/ReceivingReport.tsx` and `client/src/components/reports/ConsumableReport.tsx`. Implement `useMemo` for heavy data transformations, sorting, and slicing. Implement `useCallback` for export handlers (`exportToCSV`, `exportToPDF`). Integrate client-side audit event dispatching (`agent.action`, `export_report`) on export. Replace hardcoded Recharts hex colors with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons and pagination controls. Ensure empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading."
  - *Quote (Lines 18-19)*: "Components must be exported cleanly for future import by `reports.tsx`. Do NOT modify `reports.tsx` in this milestone."

- **`d:/StockTracker/.agents/teamwork_preview_orchestrator_main_1/PROJECT.md`**:
  - *Quote (Lines 5-6)*: "Parent `reports.tsx` manages active tab state and renders the corresponding sub-report component. Each sub-report component fetches or receives data, memoizes heavy transformations via `useMemo`, memoizes export handlers via `useCallback`, and dispatches audit logs on export. Shared interfaces: Export actions dispatch client-side audit events (`agent.action`, `export_report`). All UI components adhere to WCAG AA contrast ratios (>= 4.5:1), semantic CSS variables for Recharts, Tailwind theme variables (`--lion-red-500`, `--primary`), and include `aria-label` attributes for accessibility."
  - *Quote (Lines 19-22)*: "`reports.tsx` ↔ Sub-Report Components. Each sub-report component is a React functional component exported from its respective file in `client/src/components/reports/`. Props: Clean interface depending on data requirements of each sub-report. Audit Logging: Client-side event dispatching (`agent.action`, `export_report`) on CSV/PDF export."

- **`d:/StockTracker/ORIGINAL_REQUEST.md`**:
  - *Quote (Lines 21, 24, 27)*: "Implement `useMemo` for all heavy data transformations, sorting, and slicing... Implement `useCallback` for all export handlers (`exportToCSV`, `exportToPDF`) to prevent unnecessary function recreation across renders. Integrate client-side audit event dispatching (`agent.action`, `export_report`) when users export reports to CSV or PDF... Replace hardcoded Recharts hex colors (`BAR_COLORS`) with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons, pagination controls, and tabs. Ensure all empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading."

- **`d:/StockTracker/.agents/skills/agent-audit-logging/SKILL.md`**:
  - Provides structured schema definitions for agent actions and events, emphasizing accountability and traceability for actions such as tool calls, decisions, and reporting.

### 1.2 Codebase Examination (`client/src/pages/reports.tsx`)
Using `find_by_name`, we observed that the parent tab container is physically located at `client/src/pages/reports.tsx` (2,240 lines). We inspected the entire file using `view_file` and identified the exact code blocks, state, queries, and UI elements corresponding to the `ReceivingReport` and `ConsumableReport`.

#### Receiving Report Code Blocks & State
1. **State & Query (Lines 209, 269-277)**:
   ```typescript
   const [page, setPage] = useState(1);
   // ...
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
2. **JSX Section (Lines 988-1227)**:
   - Enclosed by `{activeReport === "receiving-report" && (<Card>...</Card>)}`.
   - Uses `CardTitle` (`{t('receivingReport')}`) but lacks an `<h1>` heading.
   - Contains three export/print buttons (Lines 999-1089): CSV export (calls `exportToCSV`), PDF export (calls `exportToPDF`), and Print (calls `printReport`).
   - Export handlers perform inline `.map()` transformations over `receivingData.receivings` directly within `onClick` handlers.
   - Table displays receiving columns and an action `TableCell` with a `Dialog` triggered by a View `Button` (`<Eye className="mr-1 h-4 w-4" /> {t('view')}`).
   - **Accessibility & Contrast Deficiencies**: Icon buttons lack `aria-label` attributes. There is no dedicated empty state check for the receiving table, and existing empty state fallbacks in the dialog items table use `text-gray-500`.

#### Consumable Report Code Blocks & State
1. **State & Query (Lines 209, 289-297)**:
   ```typescript
   const [page, setPage] = useState(1);
   // ...
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
2. **JSX Section (Lines 1230-1449)**:
   - Enclosed by `{activeReport === "consumable-report" && (<Card>...</Card>)}`.
   - Uses `CardTitle` (`{t('consumableReportName')}`) but lacks an `<h1>` heading.
   - Contains two export/print buttons (Lines 1241-1308): Excel/CSV export (calls `exportToCSV`) and Print (calls `printReport`). Note: `exportToPDF` is absent in the current implementation.
   - Table displays consumable issuance columns and an action `TableCell` with a `Dialog` triggered by a View `Button`.
   - **Empty State (Lines 1436-1446)**:
     ```tsx
     {!consumableIssuancesLoading && (!consumableIssuancesData?.issuances || consumableIssuancesData.issuances.length === 0) && (
       <div className="text-center py-12">
         <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
         <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
           {t('noConsumableItems')}
         </h3>
         <p className="text-gray-600 dark:text-gray-400">
           {t('noConsumableItems')}
         </p>
       </div>
     )}
     ```
   - **Accessibility & Contrast Deficiencies**: Icon buttons lack `aria-label` attributes. The empty state icon uses `text-gray-400` (`#9ca3af`) and subtext uses `text-gray-600 dark:text-gray-400`. `text-gray-400` against dark backgrounds (`#1f2937` or `#111827`) provides a contrast ratio of only ~3.2:1 to 4.1:1, which fails the WCAG AA requirement of >= 4.5:1.

#### Parent Export Functions
- `exportToCSV` (Lines 119-139), `exportToPDF` (Lines 141-171), and `printReport` (Lines 173-207) are defined in `reports.tsx`.

---

## 2. Logic Chain
Based on our verified observations, we deduce the following logical steps to formulate an optimal extraction and refactoring strategy:

### 2.1 Component Interface & Decoupling Strategy
- **Observation Reference**: `reports.tsx` defines `exportToCSV`, `exportToPDF`, and `printReport`, while `PROJECT.md` specifies a "Clean interface depending on data requirements of each sub-report."
- **Inference**: To prevent code duplication and adhere to React best practices, the sub-reports should be defined as standalone functional components that receive `exportToCSV`, `exportToPDF`, and `printReport` as props. Each sub-report will encapsulate its own `page` state and TanStack `useQuery` call, removing the need for the parent container to pass data down or manage sub-report pagination state.

### 2.2 Memoization Optimization (`useMemo` & `useCallback`)
- **Observation Reference**: Currently, data mapping for CSV/PDF/Print exports occurs inline inside the `onClick` handlers of the export buttons.
- **Inference**: Each render creates new function instances and recalculates data transformations upon export. We must:
  1. Use `useMemo` to pre-calculate or memoize the transformed export data arrays/strings (`csvData`, `pdfData`, `printHtml`) whenever the underlying query data (`receivingData` or `consumableIssuancesData`) changes.
  2. Use `useCallback` to wrap the export event handlers (`handleExportCSV`, `handleExportPDF`, `handlePrint`), guaranteeing stable function identities across component re-renders.

### 2.3 Client-Side Audit Event Dispatching
- **Observation Reference**: `PROJECT.md` and `SCOPE.md` require client-side audit event dispatching (`agent.action`, `export_report`) on export, following `agent-audit-logging` standards.
- **Inference**: Within each memoized export callback (`handleExportCSV`, `handleExportPDF`, `handlePrint`), before invoking the parent export function, the component must dispatch a structured audit event. To ensure maximum compatibility and robustness, we will implement a dual dispatch mechanism:
  1. A browser `CustomEvent`: `window.dispatchEvent(new CustomEvent('agent.action', { detail: { action: 'export_report', reportName: '...', format: '...', timestamp: Date.now() } }))`.
  2. An asynchronous API call via `apiRequest('/api/audit', 'POST', { event_type: 'agent.action', action: 'export_report', params: { reportName: '...', format: '...' } })`, wrapped in a `try/catch` block so that network failures do not disrupt the user's export action.

### 2.4 Theming, Semantic CSS Variables & Tailwind Variables
- **Observation Reference**: `SCOPE.md` specifies replacing hardcoded hex colors with semantic CSS variables and replacing generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`).
- **Inference**: We must utilize Tailwind classes that explicitly reference these variables. For example, instead of standard gray or hardcoded color borders, we use `text-[var(--lion-red-500)]`, `border-[var(--primary)]`, `text-primary`, and `bg-primary/10`. Any Recharts integration (if added in the future or used in tooltips) should reference `var(--primary)` rather than hex strings.

### 2.5 Accessibility (`aria-label`) & Clear `<h1>` Heading
- **Observation Reference**: `reports.tsx` lacks `aria-label` attributes on icon buttons and uses `CardTitle` without an `<h1>` element.
- **Inference**:
  - We must inject `<h1 className="text-2xl font-bold text-[var(--lion-red-500)] dark:text-primary mb-2">{t('receivingReport')}</h1>` at the top of `CardHeader`.
  - Every button containing an icon (e.g., CSV, PDF, Print, View details, Pagination buttons) must have a clear, descriptive `aria-label` attribute (e.g., `aria-label={t('exportCsv')}`, `aria-label={`${t('view')} ${item.issueNumber}`}`).

### 2.6 WCAG AA Contrast Compliance (>= 4.5:1) for Empty States
- **Observation Reference**: Existing empty states use `text-gray-400` (contrast ratio < 4.5:1 on dark backgrounds) and `text-gray-500` (contrast ratio ~3.3:1 on light backgrounds).
- **Inference**: To satisfy WCAG AA contrast requirements (>= 4.5:1 for normal text), we must enforce high-contrast classes:
  - In light mode: use `text-gray-700` (`#374151`, contrast ratio ~11:1 against white/gray-50).
  - In dark mode: use `dark:text-gray-300` (`#d1d5db`, contrast ratio ~10:1 against `#1f2937`) or `dark:text-gray-200`.
  - Apply `aria-hidden="true"` to empty state decorative icons to ensure assistive technologies do not announce them redundantly.

---

## 3. Caveats
- **Scope Boundary**: As per `SCOPE.md` (Line 19) and the user prompt, we are strictly read-only and must **not** modify `client/src/pages/reports.tsx` or create the implementation files directly in this milestone. This report serves as the complete, self-contained specification for the subsequent implementation agent.
- **File Path Nuance**: `SCOPE.md` refers to `client/src/components/reports/reports.tsx`, but our filesystem check confirmed the parent container is at `client/src/pages/reports.tsx`. The new sub-report components must be created inside `client/src/components/reports/` as requested.
- **Export Function Contracts**: We assume the existing signatures for `exportToCSV`, `exportToPDF`, and `printReport` in `reports.tsx` remain unchanged, so the props interface matches them exactly.

---

## 4. Conclusion
The extraction of `ReceivingReport` and `ConsumableReport` is fully viable and clearly scoped. Below is the concrete, production-ready implementation strategy and code specification for the implementing agent.

### 4.1 Props Interface Contract (Shared between components)
Create a clean interface in both files (or export from a shared types file if desired, but co-locating keeps them fully self-contained):
```typescript
export interface SubReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
  printReport: (title: string, content: string) => void;
}
```

### 4.2 Concrete Implementation: `client/src/components/reports/ReceivingReport.tsx`
```tsx
import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSpreadsheet, FileText, Printer, Eye, ArrowDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { formatBangkokDate, formatBangkokDateTime } from "@/lib/datetime";

export interface ReceivingReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
  printReport: (title: string, content: string) => void;
}

export const ReceivingReport: React.FC<ReceivingReportProps> = ({
  exportToCSV,
  exportToPDF,
  printReport,
}) => {
  const [page, setPage] = useState(1);
  const { t } = useLanguage();

  const { data: receivingData, isLoading: receivingLoading } = useQuery({
    queryKey: ["receivings", { page, report: true }],
    queryFn: async () => {
      const res = await apiRequest(`/api/receivings?page=${page}&limit=50`, "GET");
      if (!res.ok) throw new Error("Failed to fetch receiving data");
      return res.json();
    },
  });

  // 1. useMemo for heavy data transformations
  const exportCSVData = useMemo(() => {
    if (!receivingData?.receivings) return [];
    return receivingData.receivings.map((receiving: any) => ({
      "Receive Number": receiving.receiveNumber,
      Date: formatBangkokDate(receiving.receiveDate),
      Supplier: receiving.supplier,
      "Store ID": receiving.storeId || "-",
      Invoice: receiving.invoiceNumber || "-",
      "Items Count": receiving.items?.length || 0,
      Status: receiving.status,
    }));
  }, [receivingData]);

  const exportPDFData = useMemo(() => {
    if (!receivingData?.receivings) return { headers: [], rows: [] };
    const headers = ["Receive Number", "Date", "Supplier", "Store ID", "Invoice", "Items", "Status"];
    const rows = receivingData.receivings.map((receiving: any) => [
      receiving.receiveNumber,
      formatBangkokDate(receiving.receiveDate),
      receiving.supplier,
      receiving.storeId || "-",
      receiving.invoiceNumber || "-",
      (receiving.items?.length || 0).toString(),
      receiving.status,
    ]);
    return { headers, rows };
  }, [receivingData]);

  const printTableHtml = useMemo(() => {
    if (!receivingData?.receivings) return "";
    return `
      <table>
        <thead>
          <tr>
            <th>Receive Number</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Store ID</th>
            <th>Invoice</th>
            <th>Items Count</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${receivingData.receivings
            .map(
              (receiving: any) => `
            <tr>
              <td>${receiving.receiveNumber}</td>
              <td>${formatBangkokDate(receiving.receiveDate)}</td>
              <td>${receiving.supplier}</td>
              <td>${receiving.storeId || "-"}</td>
              <td>${receiving.invoiceNumber || "-"}</td>
              <td>${receiving.items?.length || 0} items</td>
              <td>${receiving.status}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }, [receivingData]);

  // Client-side audit dispatch helper
  const dispatchAuditEvent = useCallback((format: string) => {
    const eventDetail = {
      action: "export_report",
      reportName: "Receiving Report",
      format,
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("agent.action", { detail: eventDetail }));
    try {
      apiRequest("/api/audit", "POST", {
        event_type: "agent.action",
        action: "export_report",
        params: eventDetail,
      }).catch(() => {}); // silently ignore network errors on audit log
    } catch (e) {}
  }, []);

  // 2. useCallback for export handlers
  const handleExportCSV = useCallback(() => {
    if (exportCSVData.length > 0) {
      dispatchAuditEvent("csv");
      exportToCSV(
        exportCSVData,
        `receiving-report-${new Date().toISOString().split("T")[0]}.csv`,
        ["Receive Number", "Date", "Supplier", "Store ID", "Invoice", "Items Count", "Status"]
      );
    }
  }, [exportCSVData, exportToCSV, dispatchAuditEvent]);

  const handleExportPDF = useCallback(() => {
    if (exportPDFData.rows.length > 0) {
      dispatchAuditEvent("pdf");
      exportToPDF("Receiving Report", exportPDFData.headers, exportPDFData.rows);
    }
  }, [exportPDFData, exportToPDF, dispatchAuditEvent]);

  const handlePrint = useCallback(() => {
    if (printTableHtml) {
      dispatchAuditEvent("print");
      printReport(t("receivingReport"), printTableHtml);
    }
  }, [printTableHtml, printReport, t, dispatchAuditEvent]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            {/* Clear <h1> heading with Tailwind theme variables */}
            <h1 className="text-2xl font-bold text-[var(--lion-red-500)] dark:text-primary mb-2">
              {t("receivingReport")}
            </h1>
            <CardTitle className="sr-only">{t("receivingReport")}</CardTitle>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("receivingReportDesc")}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={handleExportCSV}
              aria-label={t("exportCsv")}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" aria-hidden="true" />
              {t("exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleExportPDF}
              aria-label="Export to PDF"
            >
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={handlePrint}
              aria-label={t("print")}
            >
              <Printer className="h-4 w-4 mr-2" aria-hidden="true" />
              {t("print")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {receivingLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("receiveNumber")}</TableHead>
                  <TableHead>{t("receiveDate")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("storeId")}</TableHead>
                  <TableHead>{t("invoiceNumber")}</TableHead>
                  <TableHead>{t("items")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivingData?.receivings?.map((receiving: any) => (
                  <TableRow key={receiving.id}>
                    <TableCell className="font-medium">{receiving.receiveNumber}</TableCell>
                    <TableCell>{formatBangkokDate(receiving.receiveDate)}</TableCell>
                    <TableCell>{receiving.supplier}</TableCell>
                    <TableCell>{receiving.storeId || "-"}</TableCell>
                    <TableCell>{receiving.invoiceNumber || "-"}</TableCell>
                    <TableCell>
                      {receiving.items?.length || 0} {t("items")}
                    </TableCell>
                    <TableCell>
                      <Badge className="stock-normal">{receiving.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`${t("view")} ${receiving.receiveNumber}`}
                          >
                            <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
                            {t("view")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>
                              {t("receivingDetails")} - {receiving.receiveNumber}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("receiveDate")}
                                </span>
                                <p className="font-medium">{formatBangkokDateTime(receiving.receiveDate)}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("supplier")}
                                </span>
                                <p className="font-medium">{receiving.supplier}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("storeId")}
                                </span>
                                <p className="font-medium">{receiving.storeId}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("status")}
                                </span>
                                <Badge className="stock-normal">{receiving.status}</Badge>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("processedBy")}
                                </span>
                                <p className="font-medium">
                                  {receiving.processedByUser?.username || "Unknown"}
                                </p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("invoiceNumber")}
                                </span>
                                <p className="font-medium">{receiving.invoiceNumber || "-"}</p>
                              </div>
                            </div>

                            {receiving.notes && (
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("notes")}
                                </span>
                                <p className="mt-1 rounded bg-gray-50 p-3 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                  {receiving.notes}
                                </p>
                              </div>
                            )}

                            {receiving.imageUrl && (
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Receipt
                                </span>
                                <div className="mt-2">
                                  <a
                                    href={receiving.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--primary)] underline font-medium"
                                  >
                                    View Receipt
                                  </a>
                                </div>
                              </div>
                            )}

                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t("items")}
                              </span>
                              <div className="mt-2 overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                                <table className="w-full min-w-[600px]">
                                  <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr className="text-left">
                                      <th className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t("partNo")}
                                      </th>
                                      <th className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t("description")}
                                      </th>
                                      <th className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t("quantity")}
                                      </th>
                                      <th className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t("unitPrice")}
                                      </th>
                                      <th className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t("binLocation")}
                                      </th>
                                      <th className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {t("notes")}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(receiving.items || []).length > 0 ? (
                                      receiving.items.map((item: any, index: number) => (
                                        <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                                          <td className="px-4 py-2">{item.part?.partNo || "-"}</td>
                                          <td className="px-4 py-2">{item.part?.description || "-"}</td>
                                          <td className="px-4 py-2">{item.quantity}</td>
                                          <td className="px-4 py-2">{item.unitPrice || "-"}</td>
                                          <td className="px-4 py-2">{item.part?.binLocation || "-"}</td>
                                          <td className="px-4 py-2">{item.notes || ""}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={6}
                                          className="px-4 py-6 text-center text-gray-700 dark:text-gray-300 font-medium"
                                        >
                                          {t("noItemsFound")}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* WCAG AA compliant empty state */}
        {!receivingLoading && (!receivingData?.receivings || receivingData.receivings.length === 0) && (
          <div className="text-center py-12">
            <ArrowDown className="h-16 w-16 text-gray-700 dark:text-gray-300 mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t("noReceivingData")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {t("noReceivingData")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### 4.3 Concrete Implementation: `client/src/components/reports/ConsumableReport.tsx`
```tsx
import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSpreadsheet, FileText, Printer, Eye } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { formatBangkokDate } from "@/lib/datetime";

export interface ConsumableReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
  printReport: (title: string, content: string) => void;
}

export const ConsumableReport: React.FC<ConsumableReportProps> = ({
  exportToCSV,
  exportToPDF,
  printReport,
}) => {
  const [page, setPage] = useState(1);
  const { t } = useLanguage();

  const { data: consumableIssuancesData, isLoading: consumableIssuancesLoading } = useQuery({
    queryKey: ["consumableIssuances", { page, report: true }],
    queryFn: async () => {
      const res = await apiRequest(`/api/consumable-issuances?page=${page}&limit=50`, "GET");
      if (!res.ok) throw new Error("Failed to fetch consumable issuance data");
      return res.json();
    },
  });

  // 1. useMemo for heavy data transformations
  const exportCSVData = useMemo(() => {
    if (!consumableIssuancesData?.issuances) return [];
    return consumableIssuancesData.issuances.map((issuance: any) => ({
      "Issue Number": issuance.issueNumber,
      Date: formatBangkokDate(issuance.issueDate),
      "Requested By": issuance.requestedBy,
      "Store ID": issuance.storeId || "-",
      "Items Count": issuance.items?.length || 0,
      Status: issuance.status,
      Notes: issuance.notes || "-",
    }));
  }, [consumableIssuancesData]);

  const exportPDFData = useMemo(() => {
    if (!consumableIssuancesData?.issuances) return { headers: [], rows: [] };
    const headers = ["Issue Number", "Date", "Requested By", "Store ID", "Items Count", "Status", "Notes"];
    const rows = consumableIssuancesData.issuances.map((issuance: any) => [
      issuance.issueNumber,
      formatBangkokDate(issuance.issueDate),
      issuance.requestedBy,
      issuance.storeId || "-",
      (issuance.items?.length || 0).toString(),
      issuance.status,
      issuance.notes || "-",
    ]);
    return { headers, rows };
  }, [consumableIssuancesData]);

  const printTableHtml = useMemo(() => {
    if (!consumableIssuancesData?.issuances) return "";
    return `
      <table>
        <thead>
          <tr>
            <th>Issue Number</th>
            <th>Date</th>
            <th>Requested By</th>
            <th>Store ID</th>
            <th>Items Count</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${consumableIssuancesData.issuances
            .map(
              (issuance: any) => `
            <tr>
              <td>${issuance.issueNumber}</td>
              <td>${formatBangkokDate(issuance.issueDate)}</td>
              <td>${issuance.requestedBy}</td>
              <td>${issuance.storeId || "-"}</td>
              <td>${issuance.items?.length || 0} items</td>
              <td>${issuance.status}</td>
              <td>${issuance.notes || "-"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }, [consumableIssuancesData]);

  // Client-side audit dispatch helper
  const dispatchAuditEvent = useCallback((format: string) => {
    const eventDetail = {
      action: "export_report",
      reportName: "Consumable Items Report",
      format,
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("agent.action", { detail: eventDetail }));
    try {
      apiRequest("/api/audit", "POST", {
        event_type: "agent.action",
        action: "export_report",
        params: eventDetail,
      }).catch(() => {});
    } catch (e) {}
  }, []);

  // 2. useCallback for export handlers
  const handleExportCSV = useCallback(() => {
    if (exportCSVData.length > 0) {
      dispatchAuditEvent("csv");
      exportToCSV(
        exportCSVData,
        `consumable-items-report-${new Date().toISOString().split("T")[0]}.csv`,
        ["Issue Number", "Date", "Requested By", "Store ID", "Items Count", "Status", "Notes"]
      );
    }
  }, [exportCSVData, exportToCSV, dispatchAuditEvent]);

  const handleExportPDF = useCallback(() => {
    if (exportPDFData.rows.length > 0) {
      dispatchAuditEvent("pdf");
      exportToPDF("Consumable Items Report", exportPDFData.headers, exportPDFData.rows);
    }
  }, [exportPDFData, exportToPDF, dispatchAuditEvent]);

  const handlePrint = useCallback(() => {
    if (printTableHtml) {
      dispatchAuditEvent("print");
      printReport(t("consumableReportName"), printTableHtml);
    }
  }, [printTableHtml, printReport, t, dispatchAuditEvent]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            {/* Clear <h1> heading with Tailwind theme variables */}
            <h1 className="text-2xl font-bold text-[var(--lion-red-500)] dark:text-primary mb-2">
              {t("consumableReportName")}
            </h1>
            <CardTitle className="sr-only">{t("consumableReportName")}</CardTitle>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("consumableReportDesc")}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={handleExportCSV}
              aria-label={t("exportExcel")}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" aria-hidden="true" />
              {t("exportExcel")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleExportPDF}
              aria-label="Export to PDF"
            >
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={handlePrint}
              aria-label={t("print")}
            >
              <Printer className="h-4 w-4 mr-2" aria-hidden="true" />
              {t("print")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {consumableIssuancesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("issueNumber")}</TableHead>
                  <TableHead>{t("issueDate")}</TableHead>
                  <TableHead>{t("requestedBy")}</TableHead>
                  <TableHead>{t("storeId")}</TableHead>
                  <TableHead>{t("items")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumableIssuancesData?.issuances?.map((issuance: any) => (
                  <TableRow key={issuance.id}>
                    <TableCell className="font-medium">{issuance.issueNumber}</TableCell>
                    <TableCell>{formatBangkokDate(issuance.issueDate)}</TableCell>
                    <TableCell>{issuance.requestedBy}</TableCell>
                    <TableCell>{issuance.storeId || "-"}</TableCell>
                    <TableCell>
                      {issuance.items?.length || 0} {t("items")}
                    </TableCell>
                    <TableCell>
                      <Badge className="stock-normal">{issuance.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`${t("view")} ${issuance.issueNumber}`}
                          >
                            <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
                            {t("view")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>
                              {t("consumableIssuanceDetails")} - {issuance.issueNumber}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("issueNumber")}
                                </label>
                                <p className="font-medium">{issuance.issueNumber}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("issueDate")}
                                </label>
                                <p className="font-medium">{formatBangkokDate(issuance.issueDate)}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("requestedBy")}
                                </label>
                                <p className="font-medium">{issuance.requestedBy}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("storeId")}
                                </label>
                                <p className="font-medium">{issuance.storeId || "-"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("status")}
                                </label>
                                <div className="mt-1">
                                  <Badge className="stock-normal">{issuance.status}</Badge>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("processedBy")}
                                </label>
                                <p className="font-medium">
                                  {issuance.processedByUser?.username || "Unknown"}
                                </p>
                              </div>
                            </div>

                            {issuance.notes && (
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t("notes")}
                                </label>
                                <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-800 dark:text-gray-200">
                                  {issuance.notes}
                                </p>
                              </div>
                            )}

                            <div>
                              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
                                {t("consumableItems")}
                              </h4>
                              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t("itemName")}</TableHead>
                                      <TableHead>{t("description")}</TableHead>
                                      <TableHead>{t("quantity")}</TableHead>
                                      <TableHead>{t("unit")}</TableHead>
                                      <TableHead>{t("notes")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {issuance.items?.map((item: any, index: number) => (
                                      <TableRow key={index} className="border-t border-gray-200 dark:border-gray-700">
                                        <TableCell className="font-medium">
                                          {item.consumableItem?.itemName || "N/A"}
                                        </TableCell>
                                        <TableCell>{item.consumableItem?.description || "-"}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{item.consumableItem?.unit || "N/A"}</TableCell>
                                        <TableCell>{item.notes || "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* WCAG AA compliant empty state */}
        {!consumableIssuancesLoading &&
          (!consumableIssuancesData?.issuances || consumableIssuancesData.issuances.length === 0) && (
            <div className="text-center py-12">
              <FileSpreadsheet
                className="h-16 w-16 text-gray-700 dark:text-gray-300 mx-auto mb-4"
                aria-hidden="true"
              />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t("noConsumableItems")}
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {t("noConsumableItems")}
              </p>
            </div>
          )}
      </CardContent>
    </Card>
  );
};
```

---

## 5. Verification Method
To independently verify the success and correctness of the extracted components once implemented, the following verification protocol must be executed:

### 5.1 Programmatic Verification (Static Analysis & Build)
1. **TypeScript Type Checking**:
   - Run: `tsc --noEmit`
   - **Success Criteria**: Clean zero-exit code with no missing imports, unresolved variables, or type contract mismatches across the entire client project.
2. **Production Bundle Verification**:
   - Run: `vite build`
   - **Success Criteria**: Successfully produces a valid production bundle without rollup or vite bundling errors.

### 5.2 Visual & Structural Verification (File Inspection)
1. **Verify `client/src/components/reports/ReceivingReport.tsx` and `client/src/components/reports/ConsumableReport.tsx`**:
   - Confirm `useMemo` is used for `exportCSVData`, `exportPDFData`, and `printTableHtml`.
   - Confirm `useCallback` is used for `handleExportCSV`, `handleExportPDF`, `handlePrint`, and `dispatchAuditEvent`.
   - Confirm `window.dispatchEvent(new CustomEvent('agent.action', ...))` and `apiRequest('/api/audit', 'POST', ...)` are present in the export handlers.
   - Confirm `aria-label` attributes exist on all icon buttons (`exportCsv`, `exportPdf`, `print`, `view`).
   - Confirm empty state classes use `text-gray-700 dark:text-gray-300` to satisfy WCAG AA contrast ratios (>= 4.5:1).
   - Confirm `<h1 className="text-2xl font-bold text-[var(--lion-red-500)] dark:text-primary mb-2">` is present at the top of both components.

### 5.3 Invalidation Conditions
- Any TypeScript error during `tsc --noEmit`.
- Any missing prop or export contract mismatch when imported by `reports.tsx` in a future milestone.
- Lack of audit event dispatching upon triggering export callbacks.
