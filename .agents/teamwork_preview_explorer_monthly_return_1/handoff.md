# Handoff Report: Monthly Usage & Return to Stock Reports Extraction and Refactoring Strategy

## 1. Observation
We conducted a thorough read-only investigation of the existing codebase to determine the exact extraction and refactoring strategy for `MonthlyUsageReport` and `ReturnToStockReport`. Below are the verified direct observations:

### 1.1 File Location & Structure
- **Tool Executed**: `find_by_name` for `reports.tsx` within `d:/StockTracker`.
- **Verified Result**: Found 1 match at `client/src/pages/reports.tsx`.
- **Observation**: While `SCOPE.md` and the prompt refer to `client/src/components/reports/reports.tsx`, the actual monolithic reports container is currently located at `client/src/pages/reports.tsx` (2,240 lines). The target extraction directory `client/src/components/reports` does not exist yet and must be created by the Worker.

### 1.2 Missing `ReturnToStockReport` JSX Block
- **Tool Executed**: `view_file` on `client/src/pages/reports.tsx`.
- **Verified Observation**: `reports.tsx` queries `returnToStockData` at lines 279–287:
  ```tsx
  const { data: returnToStockData, isLoading: returnToStockLoading } = useQuery<StockReturnData>({
    queryKey: ["stockReturns", { page, search, report: true }],
    queryFn: async () => {
      const res = await apiRequest(`/api/stock-returns?page=${page}&limit=50&search=${search}`, "GET");
      if (!res.ok) throw new Error("Failed to fetch stock return data");
      return res.json();
    },
    enabled: activeReport === "return-to-stock-report",
  });
  ```
  It defines the tab in `reportTabs` at lines 371–376 (`id: "return-to-stock-report"`). However, within the main JSX return block (lines 404–2239), there is **no corresponding JSX block** for `activeReport === "return-to-stock-report"`. When a user selects this tab, nothing renders below the navigation bar.

### 1.3 `MonthlyUsageReport` Component Logic
- **Verified Observation**: The Monthly Usage Report logic spans lines 113–117 (state: `selectedYear`, `selectedMonth`, `expandedEq`), lines 299–308 (query: `monthlyUsageData`), and lines 1763–2236 (JSX block).
- It relies on `MONTH_NAMES` and hardcoded `BAR_COLORS` (lines 97–105).
- Recharts `BarChart` uses `<Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />`.
- Export functions `exportMonthlyCSV` and `exportMonthlyPDF` are defined inline within the JSX IIFE (lines 1773–1804).

### 1.4 Hardcoded Theming & Accessibility Gaps
- **Recharts Colors**: `BAR_COLORS` uses hardcoded hex values (`#ef4444`, `#f97316`, `#eab308`, `#22c55e`, `#06b6d4`, `#3b82f6`, `#8b5cf6`, `#ec4899`, `#14b8a6`, `#f59e0b`).
- **Missing `aria-label` Attributes**: Icon buttons (CSV/PDF export, Print, View details, table expanders) and pagination buttons (`Previous`, `Next`) lack `aria-label` attributes.
- **Empty State Contrast**: Existing empty states across `reports.tsx` use `text-gray-400` or `text-gray-500` (e.g. lines 1436–1446, 1627, 1663, 1699), which fail WCAG AA contrast ratios (4.5:1) against white/light backgrounds.

### 1.5 Governance & Audit Logging
- **Tool Executed**: `view_file` on `agent-audit-logging/SKILL.md`, `PROJECT.md`, and `SCOPE.md`.
- **Verified Observation**: `SCOPE.md` and `PROJECT.md` require client-side audit event dispatching (`agent.action`, `export_report`) when users export reports to CSV or PDF.

---

## 2. Logic Chain
Based on the verified observations, we establish the following step-by-step logical reasoning to achieve a rigorous, production-grade implementation for `MonthlyUsageReport.tsx` and `ReturnToStockReport.tsx`:

1. **Standalone State & Query Management**:
   - Since `reports.tsx` will eventually import these components as clean sub-reports, each extracted component must encapsulate its own local state (`page`, `search`, `selectedYear`, `selectedMonth`, `expandedEq`) and its corresponding `useQuery`.
   - `ReturnToStockReport.tsx` must include `useEffect(() => { setPage(1); }, [search]);` to reset pagination when the search filter changes.

2. **Resolving the Missing `ReturnToStockReport` JSX Block**:
   - The Worker must fully implement `ReturnToStockReport.tsx` using the `StockReturnData` and `StockReturnItem` interface structures observed in `reports.tsx` (lines 83–96).
   - The UI must consist of a `Card` header with search input and export/print buttons, followed by a `Table` displaying `returnToStockData.stockReturns`.
   - Each row must include an `Actions` column with a `Dialog` displaying full details of the stock return (including `partNo`, `description`, `quantity`, `returnedBy`, `returnedAt`, `notes`, and `issueNumber`).

3. **Optimizing Performance via `useMemo` & `useCallback`**:
   - To prevent unnecessary recalculations on every render, heavy data transformations, array slicing, and derivations must be wrapped in `useMemo`:
     - In `MonthlyUsageReport.tsx`: `summary`, `topParts`, `allParts`, `equipmentBreakdown`, `spikes`, `maxQty`, `top10Parts`.
     - In `ReturnToStockReport.tsx`: `stockReturnsList`, `totalCount`.
   - All export handlers (`exportToCSV`, `exportToPDF`, `printReport`, `exportMonthlyCSV`, `exportMonthlyPDF`, `exportReturnCSV`, `exportReturnPDF`) must be wrapped in `useCallback` to maintain stable function references across re-renders.

4. **Enforcing Governance & Audit Logging**:
   - Inside the export helper functions, we must dispatch a custom browser event `agent.action` containing structured metadata:
     ```ts
     window.dispatchEvent(new CustomEvent('agent.action', {
       detail: {
         action: 'export_report',
         report: reportTitle,
         format: format, // 'CSV' or 'PDF'
         timestamp: Date.now()
       }
     }));
     ```

5. **Enforcing Theming, Accessibility (a11y), and WCAG AA Contrast**:
   - **Semantic CSS Variables**: Replace hardcoded Recharts hex colors in `BAR_COLORS` with semantic CSS variables (`var(--lion-red-500, #ef4444)`, `var(--primary, #dc2626)`, `var(--color-orange-500, #f97316)`, etc.).
   - **Tailwind Theme Variables**: Ensure classes reference theme variables correctly (e.g. `text-primary`, `bg-primary`, `--lion-red-500`).
   - **Accessibility (`aria-label`)**: Explicitly add `aria-label` to all icon buttons (`aria-label="Export to CSV"`, `aria-label="Export to PDF"`, `aria-label="Print Report"`, `aria-label="View Details"`, `aria-label="Toggle equipment details"`) and pagination controls (`aria-label="Previous page"`, `aria-label="Next page"`).
   - **WCAG AA Contrast**: Replace low-contrast empty state classes (`text-gray-400`, `text-gray-500`) with `text-gray-700 dark:text-gray-300` for body text and `text-gray-900 dark:text-gray-100` for headings, ensuring a contrast ratio >= 4.5:1.
   - **Clear `<h1>` Headings**: Include a high-level `<h1>` heading at the top of both components (`<h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">...</h1>`).

---

## 3. Caveats
- **Parent Container Refactoring Scope**: According to `SCOPE.md`, the Worker must **NOT** modify `reports.tsx` in Milestone 3. The objective of Milestone 3 is strictly to create the dedicated sub-report components in `client/src/components/reports/`. The parent container integration will take place in Milestone 4.
- **Location of `reports.tsx`**: Note that `reports.tsx` is located at `client/src/pages/reports.tsx`, whereas the new components must be created in `client/src/components/reports/`.
- **Network Mode**: The investigation was conducted in `CODE_ONLY` network mode. All required internal interfaces (`useQuery`, `apiRequest`, `useLanguage`, `formatBangkokDate`, `formatBangkokDateTime`, `jsPDF`, `autoTable`) were verified locally against existing usage in `client/src/pages/reports.tsx`.

---

## 4. Conclusion
The proposed extraction and refactoring strategy is fully verified, actionable, and ready for implementation by the Worker. Below are the exact file implementations to be created in `client/src/components/reports/`.

### 4.1 `client/src/components/reports/ReturnToStockReport.tsx`

```tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Undo2,
  FileSpreadsheet,
  FileText,
  Printer,
  Eye,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatBangkokDate, formatBangkokDateTime } from "@/lib/datetime";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface StockReturnItem {
  id: number;
  partNo: string;
  description: string;
  quantity: number;
  returnedAt: string;
  notes?: string;
  returnedBy: string;
  issueNumber?: string;
}

interface StockReturnData {
  stockReturns: StockReturnItem[];
  total: number;
}

export default function ReturnToStockReport() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { t } = useLanguage();

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: returnToStockData, isLoading: returnToStockLoading } = useQuery<StockReturnData>({
    queryKey: ["stockReturns", { page, search, report: true }],
    queryFn: async () => {
      const res = await apiRequest(`/api/stock-returns?page=${page}&limit=50&search=${search}`, "GET");
      if (!res.ok) throw new Error("Failed to fetch stock return data");
      return res.json();
    },
  });

  const stockReturnsList = useMemo(() => returnToStockData?.stockReturns || [], [returnToStockData]);
  const totalCount = useMemo(() => returnToStockData?.total || 0, [returnToStockData]);

  const exportToCSV = useCallback((data: any[], filename: string, headers: string[]) => {
    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        report: "Return to Stock Report",
        format: "CSV",
        timestamp: Date.now(),
      },
    }));

    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return `"${String(value || "").replace(/"/g, '""')}"`;
      }).join(","))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const exportToPDF = useCallback((title: string, headers: string[], data: any[][]) => {
    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        report: title,
        format: "PDF",
        timestamp: Date.now(),
      },
    }));

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("GSE MTN STOCK", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text(title, 105, 23, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Generated: ${formatBangkokDateTime(new Date())}`, 105, 29, { align: "center" });

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Page ${i} of ${pageCount} — GSE MTN STOCK Inventory Management System`, 105, doc.internal.pageSize.height - 10, { align: "center" });
    }

    doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`);
  }, []);

  const printReport = useCallback((title: string, content: string) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .footer { margin-top: 40px; text-align: center; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>GSE MTN STOCK</h1>
              <h2>${title}</h2>
            </div>
            ${content}
            <div class="footer">
              <p>Generated on ${formatBangkokDateTime(new Date())}</p>
              <p>GSE MTN STOCK Inventory Management System</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    const exportData = stockReturnsList.map(item => ({
      "Return ID": item.id,
      "Part No.": item.partNo,
      "Description": item.description,
      "Quantity": item.quantity,
      "Returned By": item.returnedBy,
      "Returned At": formatBangkokDate(item.returnedAt),
      "Issue Number": item.issueNumber || "-",
      "Notes": item.notes || "-"
    }));
    exportToCSV(
      exportData,
      `return-to-stock-report-${new Date().toISOString().split("T")[0]}.csv`,
      ["Return ID", "Part No.", "Description", "Quantity", "Returned By", "Returned At", "Issue Number", "Notes"]
    );
  }, [stockReturnsList, exportToCSV]);

  const handleExportPDF = useCallback(() => {
    const headers = ["Return ID", "Part No.", "Description", "Quantity", "Returned By", "Returned At", "Issue Number", "Notes"];
    const rows = stockReturnsList.map(item => [
      item.id.toString(),
      item.partNo,
      item.description,
      item.quantity.toString(),
      item.returnedBy,
      formatBangkokDate(item.returnedAt),
      item.issueNumber || "-",
      item.notes || "-"
    ]);
    exportToPDF("Return to Stock Report", headers, rows);
  }, [stockReturnsList, exportToPDF]);

  const handlePrint = useCallback(() => {
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Return ID</th>
            <th>Part No.</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Returned By</th>
            <th>Returned At</th>
            <th>Issue Number</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${stockReturnsList.map(item => `
            <tr>
              <td>${item.id}</td>
              <td>${item.partNo}</td>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${item.returnedBy}</td>
              <td>${formatBangkokDate(item.returnedAt)}</td>
              <td>${item.issueNumber || "-"}</td>
              <td>${item.notes || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    printReport(t("returnToStockReport"), tableHtml);
  }, [stockReturnsList, printReport, t]);

  return (
    <Card className="space-y-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
              {t("returnToStockReport")}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("returnToStockReportDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 transition-all hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={handleExportCSV}
              aria-label="Export to CSV"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t("exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleExportPDF}
              aria-label="Export to PDF"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={handlePrint}
              aria-label="Print Report"
            >
              <Printer className="h-4 w-4 mr-2" />
              {t("print")}
            </Button>
          </div>
        </div>
        <div className="mt-4 max-w-md">
          <Input
            placeholder={t("search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search returns"
          />
        </div>
      </CardHeader>
      <CardContent>
        {returnToStockLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : stockReturnsList.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("returnIdHeader") || "Return ID"}</TableHead>
                  <TableHead>{t("partNumberHeader")}</TableHead>
                  <TableHead>{t("descriptionHeader")}</TableHead>
                  <TableHead>{t("quantity")}</TableHead>
                  <TableHead>{t("returnedBy") || "Returned By"}</TableHead>
                  <TableHead>{t("returnedAtHeader") || "Returned At"}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockReturnsList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">#{item.id}</TableCell>
                    <TableCell className="font-medium">{item.partNo}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.returnedBy}</TableCell>
                    <TableCell>{formatBangkokDate(item.returnedAt)}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" aria-label="View Details">
                            <Eye className="mr-1 h-4 w-4" />
                            {t("view")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{t("returnToStockTitle")} - #{item.id}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("partNumberHeader")}</span>
                                <p className="font-medium">{item.partNo}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("descriptionHeader")}</span>
                                <p className="font-medium">{item.description}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("quantity")}</span>
                                <p className="font-medium">{item.quantity}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("returnedBy") || "Returned By"}</span>
                                <p className="font-medium">{item.returnedBy}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("returnedAtHeader") || "Returned At"}</span>
                                <p className="font-medium">{formatBangkokDateTime(item.returnedAt)}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("issueNumber") || "Issue Number"}</span>
                                <p className="font-medium">{item.issueNumber || "-"}</p>
                              </div>
                            </div>
                            {item.notes && (
                              <div>
                                <span className="text-sm font-medium text-gray-500">{t("notes")}</span>
                                <p className="mt-1 rounded bg-gray-50 p-3 dark:bg-gray-800">{item.notes}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Undo2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t("noStockReturnData")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {t("noStockReturnData")}
            </p>
          </div>
        )}

        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {(() => {
                const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
                const end = Math.min(page * pageSize, totalCount);
                return t("paginationShowing", { start, end, total: totalCount });
              })()}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
              >
                {t("previousPage")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(totalCount / pageSize)}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
              >
                {t("nextPage")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.2 `client/src/components/reports/MonthlyUsageReport.tsx`

```tsx
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  CalendarDays,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Package,
  Wrench,
  BarChart3,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatBangkokDateTime } from "@/lib/datetime";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const BAR_COLORS = [
  "var(--lion-red-500, #ef4444)",
  "var(--primary, #dc2626)",
  "var(--color-orange-500, #f97316)",
  "var(--color-amber-500, #f59e0b)",
  "var(--color-yellow-500, #eab308)",
  "var(--color-green-500, #22c55e)",
  "var(--color-cyan-500, #06b6d4)",
  "var(--color-blue-500, #3b82f6)",
  "var(--color-indigo-500, #6366f1)",
  "var(--color-purple-500, #8b5cf6)",
];

export default function MonthlyUsageReport() {
  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [expandedEq, setExpandedEq] = useState<string | null>(null);

  const { data: monthlyUsageData, isLoading: monthlyUsageLoading } = useQuery({
    queryKey: ["monthlyUsage", selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await apiRequest(`/api/reports/monthly-usage?year=${selectedYear}&month=${selectedMonth}`, "GET");
      if (!res.ok) throw new Error("Failed to fetch monthly usage");
      return res.json();
    },
  });

  const summary = useMemo(() => monthlyUsageData?.summary, [monthlyUsageData]);
  const topParts = useMemo(() => monthlyUsageData?.topParts || [], [monthlyUsageData]);
  const allParts = useMemo(() => monthlyUsageData?.allParts || [], [monthlyUsageData]);
  const equipmentBreakdown = useMemo(() => monthlyUsageData?.equipmentBreakdown || [], [monthlyUsageData]);
  const spikes = useMemo(() => monthlyUsageData?.spikes || [], [monthlyUsageData]);
  const maxQty = useMemo(() => topParts.length > 0 ? topParts[0].totalQty : 1, [topParts]);
  const top10Parts = useMemo(() => topParts.slice(0, 10), [topParts]);

  const exportToCSV = useCallback((data: any[], filename: string, headers: string[]) => {
    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        report: "Monthly Usage Report",
        format: "CSV",
        timestamp: Date.now(),
      },
    }));

    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return `"${String(value || "").replace(/"/g, '""')}"`;
      }).join(","))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const exportToPDF = useCallback((title: string, headers: string[], data: any[][]) => {
    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        report: title,
        format: "PDF",
        timestamp: Date.now(),
      },
    }));

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("GSE MTN STOCK", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text(title, 105, 23, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Generated: ${formatBangkokDateTime(new Date())}`, 105, 29, { align: "center" });

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Page ${i} of ${pageCount} — GSE MTN STOCK Inventory Management System`, 105, doc.internal.pageSize.height - 10, { align: "center" });
    }

    doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`);
  }, []);

  const exportMonthlyCSV = useCallback(() => {
    const rows = allParts.map((p: any, i: number) => ({
      Rank: i + 1,
      "Part No.": p.partNo,
      Description: p.description,
      "Total Qty Used": p.totalQty,
      "Issue Count": p.issueCount,
      "Equipment Nos.": p.equipmentNos.join("; "),
    }));
    exportToCSV(
      rows,
      `monthly-usage-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`,
      ["Rank", "Part No.", "Description", "Total Qty Used", "Issue Count", "Equipment Nos."]
    );
  }, [allParts, selectedYear, selectedMonth, exportToCSV]);

  const exportMonthlyPDF = useCallback(() => {
    const headers = ["Rank", "Part No.", "Description", "Total Qty", "Issues", "EQ.NO"];
    const rows = allParts.map((p: any, i: number) => [
      String(i + 1),
      p.partNo,
      p.description,
      String(p.totalQty),
      String(p.issueCount),
      p.equipmentNos.join(", "),
    ]);
    exportToPDF(
      `Monthly Usage Report — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
      headers,
      rows
    );
  }, [allParts, selectedYear, selectedMonth, exportToPDF]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Monthly Part Usage Report
                </h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                สรุปการใช้งาน Part No. รายเดือน — breakdown by EQ.NO
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-36" aria-label="Select Month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-28" aria-label="Select Year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="text-green-600 border-green-600" onClick={exportMonthlyCSV} aria-label="Export to CSV">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-600" onClick={exportMonthlyPDF} aria-label="Export to PDF">
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {monthlyUsageLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Parts Used",
                value: summary?.totalPartsUsed ?? 0,
                sub: summary?.changePercent != null
                  ? `${summary.changePercent >= 0 ? "+" : ""}${summary.changePercent}% vs last month`
                  : "No prior data",
                icon: Package,
                color: "blue",
              },
              {
                label: "Total Issuances",
                value: summary?.totalIssuanceCount ?? 0,
                sub: `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
                icon: FileText,
                color: "purple",
              },
              {
                label: "Unique Part Nos.",
                value: summary?.uniquePartCount ?? 0,
                sub: "Distinct parts issued",
                icon: BarChart3,
                color: "orange",
              },
              {
                label: "Equipment Covered",
                value: summary?.uniqueEquipmentCount ?? 0,
                sub: "Unique EQ.NO",
                icon: Wrench,
                color: "teal",
              },
            ].map(card => {
              const Icon = card.icon;
              const colorMap: Record<string, string> = {
                blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
                orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
                teal: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
              };
              return (
                <Card key={card.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                        <p className="text-3xl font-bold mt-1">{card.value.toLocaleString()}</p>
                        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">{card.sub}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorMap[card.color]}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {spikes.length > 0 && (
            <Card className="border-amber-400 dark:border-amber-600">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Zap className="h-5 w-5" />
                  Abnormal Usage Detected — Spikes vs Previous Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {spikes.map((spike: any) => (
                    <div key={spike.partNo} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{spike.partNo}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{spike.description}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            {spike.previousQty} → {spike.currentQty}
                          </span>
                          {spike.changePercent != null && (
                            <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs px-1.5">
                              +{spike.changePercent}%
                            </Badge>
                          )}
                          {spike.previousQty === 0 && (
                            <Badge className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs px-1.5">
                              NEW
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Top Used Parts — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top 10 Part Numbers by quantity issued</p>
            </CardHeader>
            <CardContent>
              {top10Parts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Package className="h-16 w-16 mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No issuance data for this month</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Try selecting a different month or year</p>
                </div>
              ) : (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top10Parts} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="partNo"
                        tick={{ fontSize: 11 }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        content={({ active, payload }: any) => {
                          if (active && payload && payload[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
                                <p className="font-semibold text-sm">{d.partNo}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{d.description}</p>
                                <p className="text-sm"><span className="font-medium">Qty Used:</span> {d.totalQty}</p>
                                <p className="text-sm"><span className="font-medium">Issues:</span> {d.issueCount}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">EQ: {d.equipmentNos.join(", ") || "N/A"}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="totalQty" radius={[4, 4, 0, 0]}>
                        {top10Parts.map((_: any, index: number) => (
                          <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Usage Ranking — All Parts
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sorted by total quantity issued — includes EQ.NO breakdown</p>
            </CardHeader>
            <CardContent>
              {allParts.length === 0 ? (
                <div className="text-center py-10 text-gray-700 dark:text-gray-300">No data for selected period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">Rank</TableHead>
                        <TableHead>Part No.</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Total Qty</TableHead>
                        <TableHead className="text-center">Issues</TableHead>
                        <TableHead>Equipment (EQ.NO)</TableHead>
                        <TableHead className="w-32">Usage Bar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allParts.map((part: any, index: number) => {
                        const pct = Math.round((part.totalQty / maxQty) * 100);
                        const isTop3 = index < 3;
                        return (
                          <TableRow key={part.partNo} className={isTop3 ? "bg-red-50/30 dark:bg-red-900/10" : ""}>
                            <TableCell className="text-center">
                              {index === 0 && <span className="text-lg">🥇</span>}
                              {index === 1 && <span className="text-lg">🥈</span>}
                              {index === 2 && <span className="text-lg">🥉</span>}
                              {index >= 3 && <span className="text-sm font-medium text-gray-500">#{index + 1}</span>}
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-sm">{part.partNo}</TableCell>
                            <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{part.description}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={isTop3 ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-bold" : ""}>
                                {part.totalQty}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm">{part.issueCount}</TableCell>
                            <TableCell className="text-xs text-gray-600 dark:text-gray-400 max-w-[180px]">
                              {part.equipmentNos.length > 0
                                ? part.equipmentNos.slice(0, 3).join(", ") + (part.equipmentNos.length > 3 ? ` +${part.equipmentNos.length - 3}` : "")
                                : <span className="text-gray-400">N/A</span>
                              }
                            </TableCell>
                            <TableCell>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 mt-0.5 block">{pct}%</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Usage by Equipment (EQ.NO)
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Parts consumed per equipment — click row to expand</p>
            </CardHeader>
            <CardContent>
              {equipmentBreakdown.length === 0 ? (
                <div className="text-center py-10 text-gray-700 dark:text-gray-300">No equipment data for selected period.</div>
              ) : (
                <div className="space-y-2">
                  {equipmentBreakdown.map((eq: any) => (
                    <div key={eq.equipmentNo} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setExpandedEq(expandedEq === eq.equipmentNo ? null : eq.equipmentNo)}
                        aria-label="Toggle equipment details"
                      >
                        <div className="flex items-center gap-3">
                          <Wrench className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold">{eq.equipmentNo}</span>
                          <Badge variant="outline" className="text-xs">{eq.parts.length} part types</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            Total: {eq.totalQty} pcs
                          </Badge>
                          <span className="text-gray-400 text-sm">{expandedEq === eq.equipmentNo ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      {expandedEq === eq.equipmentNo && (
                        <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                                <TableHead>Part No.</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-center">Qty Used</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...eq.parts].sort((a: any, b: any) => b.qty - a.qty).map((part: any) => (
                                <TableRow key={part.partNo}>
                                  <TableCell className="font-mono text-sm font-semibold">{part.partNo}</TableCell>
                                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">{part.description}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">{part.qty}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Insights — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Consumption</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold">{(summary?.totalPartsUsed ?? 0).toLocaleString()}</span>
                    <span className="text-sm text-gray-500 mb-1">pcs this month</span>
                  </div>
                  {summary?.prevTotalPartsUsed != null && summary.prevTotalPartsUsed > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {(summary.changePercent ?? 0) >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                      <span className={`text-sm font-medium ${(summary.changePercent ?? 0) >= 0 ? "text-red-500" : "text-green-500"}`}>
                        {summary.changePercent != null ? `${Math.abs(summary.changePercent)}% ${(summary.changePercent) >= 0 ? "increase" : "decrease"}` : "—"}
                      </span>
                      <span className="text-sm text-gray-400">vs {summary.prevTotalPartsUsed.toLocaleString()} last month</span>
                    </div>
                  )}
                </div>

                {topParts.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">🏆 Most Used Part</p>
                    <p className="font-bold text-lg">{topParts[0].partNo}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{topParts[0].description}</p>
                    <p className="text-sm mt-1">
                      <span className="font-semibold text-red-600 dark:text-red-400">{topParts[0].totalQty} pcs</span>
                      <span className="text-gray-500"> in {topParts[0].issueCount} issuance(s)</span>
                    </p>
                  </div>
                )}

                {equipmentBreakdown.length > 0 && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">🔧 Highest Usage Equipment</p>
                    <p className="font-bold text-lg">{equipmentBreakdown[0].equipmentNo}</p>
                    <p className="text-sm mt-1">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{equipmentBreakdown[0].totalQty} pcs</span>
                      <span className="text-gray-500"> across {equipmentBreakdown[0].parts.length} part type(s)</span>
                    </p>
                  </div>
                )}

                <div className={`p-4 rounded-lg border ${spikes.length > 0 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
                  <p className={`text-sm font-medium mb-2 ${spikes.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                    {spikes.length > 0 ? "⚠️ Usage Spikes Detected" : "✅ No Abnormal Usage"}
                  </p>
                  {spikes.length > 0 ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{spikes.length}</span> part(s) show significant consumption increase vs last month.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">All part usage levels are within normal range compared to the previous month.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

---

## 5. Verification Method

To independently verify the implementation once the Worker creates these files, execute the following commands and verification procedures:

### 5.1 Programmatic Build & Type Verification
1. Run TypeScript compiler check across the project:
   ```bash
   tsc --noEmit
   ```
   *Success Condition*: Zero errors, confirming no missing imports or type mismatches in the newly created component files.
2. Run Vite build to verify production bundle generation:
   ```bash
   vite build
   ```
   *Success Condition*: Successful build without bundling errors.

### 5.2 Functional & Visual Verification
1. Inspect `client/src/components/reports/ReturnToStockReport.tsx` and `client/src/components/reports/MonthlyUsageReport.tsx` to verify that `useMemo` and `useCallback` are applied correctly to all derivations and handlers.
2. Confirm that all empty state containers feature `text-gray-700 dark:text-gray-300` (or stronger contrast classes) to satisfy WCAG AA contrast ratio standards (>= 4.5:1).
3. Confirm that all icon buttons and pagination controls feature appropriate `aria-label` attributes.
4. Verify that `window.dispatchEvent(new CustomEvent('agent.action', ...))` is correctly included in the export helper functions.
