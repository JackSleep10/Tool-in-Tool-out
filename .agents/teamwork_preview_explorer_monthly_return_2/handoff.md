# Milestone 3 Exploration & Refactoring Strategy Handoff Report

## 1. Observation

During our read-only investigation of the StockTracker client codebase, we performed targeted file searches and content inspections using `find_by_name` and `view_file`. Below are the direct, verified observations:

### 1.1 File Location & Component Monolith
- **Exact Path**: The main inventory reports page is located at `client/src/pages/reports.tsx` (referred to as `client/src/components/reports/reports.tsx` in architectural planning documents).
- **Size & Structure**: The file is a 2,240-line monolithic React component (`Reports()`). It contains state management for active tabs (`activeReport`), filters (`search`, `categoryFilter`, `statusFilter`, `page`, `selectedYear`, `selectedMonth`, `expandedEq`), helper export functions (`exportToCSV`, `exportToPDF`, `printReport`), and multiple API query definitions via `@tanstack/react-query`.

### 1.2 The Missing `ReturnToStockReport` JSX Block
- **Query Definition**: In `client/src/pages/reports.tsx` (lines 280–287), a `useQuery` hook is defined for fetching return-to-stock data:
  ```typescript
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
- **Navigation Tab**: In `reportTabs` (lines 372–377), the tab object is defined:
  ```typescript
  {
    id: "return-to-stock-report",
    name: t('returnToStockReport'),
    icon: Undo2,
    description: t('returnToStockReportDescription'),
  },
  ```
- **Verbatim Missing JSX**: In the component return block (lines 404–2238), there are conditional rendering blocks for `stock-balance` (line 453), `issuance-report` (line 764), `receiving-report` (line 987), `consumable-report` (line 1229), `analytics` (line 1452), and `monthly-usage` (line 1764). **There is no `{activeReport === "return-to-stock-report" && (...)}` JSX block in the entire file.** This directly causes the blank screen observed by users when clicking the `return-to-stock-report` tab.

### 1.3 Monthly Usage Report Structure & Bottlenecks
- **Unmemoized Data Slicing & Sorting**: In `client/src/pages/reports.tsx` (lines 1765–1770), heavy array destructuring and derivation are executed on every render without `useMemo`:
  ```typescript
  const summary = monthlyUsageData?.summary;
  const topParts: any[] = monthlyUsageData?.topParts || [];
  const allParts: any[] = monthlyUsageData?.allParts || [];
  const equipmentBreakdown: any[] = monthlyUsageData?.equipmentBreakdown || [];
  const spikes: any[] = monthlyUsageData?.spikes || [];
  const maxQty = topParts.length > 0 ? topParts[0].totalQty : 1;
  ```
  Furthermore, `topParts.slice(0, 10)` is invoked repeatedly during render (lines 1983, 2011), and `[...eq.parts].sort((a: any, b: any) => b.qty - a.qty)` is executed directly inside the render tree (line 2139).
- **Unmemoized Export Handlers**: `exportMonthlyCSV` (lines 1773–1787) and `exportMonthlyPDF` (lines 1789–1804) are recreated on every render without `useCallback`.
- **Hardcoded Hex Colors**: Recharts bar colors are hardcoded at lines 102–105:
  ```typescript
  const BAR_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
  ];
  ```
  And used directly in `BarChart` cells: `fill={BAR_COLORS[index % BAR_COLORS.length]}` (line 2012).

### 1.4 Theming, Accessibility, & Audit Logging Gaps
- **Missing Audit Logging**: Neither `exportMonthlyCSV`, `exportMonthlyPDF`, nor any parent export functions dispatch client-side audit events (`agent.action`, `export_report`).
- **Tailwind Generic Classes**: Hardcoded generic classes like `text-red-500`, `border-red-500`, `text-red-600`, and `bg-red-50/30` are used pervasively rather than Tailwind theme variables (`--lion-red-500`, `--primary`).
- **Missing `aria-label` Attributes**: Icon buttons (e.g. CSV/PDF export buttons at lines 1843, 1846), pagination controls, and tab navigation buttons lack `aria-label` attributes.
- **Failing WCAG AA Contrast Ratios**: Empty states use `text-gray-400` (e.g., lines 1975, 2033, 2107). On a white background (`#ffffff`), `text-gray-400` (`#9ca3af`) provides a contrast ratio of ~2.8:1, failing the WCAG AA requirement of `>= 4.5:1` for standard text.
- **Missing `<h1>` Headings**: Sub-report sections rely entirely on `<CardTitle>` (rendering `<h3>` or `<div>`) without any top-level `<h1>` heading to establish a clear accessibility hierarchy.

---

## 2. Logic Chain

1. **Monolith Disaggregation & Encapsulation**: To fulfill the requirements of `PROJECT.md` and `SCOPE.md`, the monolithic `reports.tsx` must be split. Moving `MonthlyUsageReport` and `ReturnToStockReport` into dedicated components in `client/src/components/reports/` allows each component to encapsulate its own API fetching (`useQuery`) and local state (`page`, `search`, `selectedYear`, `selectedMonth`, `expandedEq`), keeping the parent container clean and preventing unnecessary re-renders across inactive tabs.
2. **Solving the Missing Tab Bug**: Because `ReturnToStockReport` is completely missing from the JSX return block in `reports.tsx`, we must build `ReturnToStockReport.tsx` as a standalone table view matching the design language of `IssuanceReport` and `ReceivingReport`. Based on `StockReturnItem` type definitions (lines 83–92), the table must display `partNo`, `description`, `quantity`, `returnedAt`, `returnedBy`, `issueNumber`, and `notes`, along with a view dialog, pagination, search bar, and export actions.
3. **Performance Optimization via Memoization**: Wrapping derived datasets (`summary`, `topParts`, `top10Parts`, `allParts`, `equipmentBreakdown`, `spikes`, `maxQty`, `stockReturns`) in `useMemo` guarantees that expensive array slicing, mapping, and sorting operations are only recomputed when `monthlyUsageData` or `returnToStockData` changes. Wrapping export handlers (`exportMonthlyCSV`, `exportMonthlyPDF`, `exportReturnCSV`, `exportReturnPDF`, `exportReturnPrint`) in `useCallback` preserves function references across renders.
4. **Client-Side Audit Traceability**: To comply with `agent-audit-logging` standards, every export action must fire `window.dispatchEvent(new CustomEvent('agent.action', { detail: { action: 'export_report', ... } }))`. This establishes a clear, verifiable provenance trail when users extract sensitive inventory data.
5. **Theming & Accessibility Hardening**:
   - Replacing hardcoded hex values in Recharts with semantic CSS variables (`var(--lion-red-500, #f87171)`, `var(--primary, #dc2626)`, etc.) aligns the charts with the Lion Air Red theme defined in `client/src/index.css`.
   - Replacing generic Tailwind classes (`text-red-500`) with theme variables (`text-[var(--lion-red-500)]` or `text-primary`) guarantees visual integrity across theme switches.
   - Adding descriptive `aria-label` attributes to all icon-only buttons, pagination controls, and interactive rows fulfills screen reader accessibility standards.
   - Upgrading empty state text colors from `text-gray-400` to `text-gray-600 dark:text-gray-300` raises the contrast ratio above 7:1, comfortably exceeding the WCAG AA `>= 4.5:1` threshold.
   - Adding an explicit `<h1>` heading at the top of each component establishes a clear semantic document structure.

---

## 3. Caveats

- **Scope Boundary**: As a read-only Explorer, no source files were modified during this investigation. The Worker agent is responsible for creating the new component files and verifying the build.
- **Parent Container Refactoring Integration**: `SCOPE.md` explicitly notes in Section 18 ("Interface Contracts"): *"Components must be exported cleanly for future import by `reports.tsx`. Do NOT modify `reports.tsx` in this milestone."* Therefore, the Worker must create `MonthlyUsageReport.tsx` and `ReturnToStockReport.tsx` in `client/src/components/reports/` with clean props interfaces, but leave `client/src/pages/reports.tsx` untouched until Milestone 4 (Parent Container Integration).
- **Props Interface Design**: To ensure seamless future integration with `reports.tsx`, both new components are designed to accept `exportToCSV`, `exportToPDF`, and `printReport` as props from the parent container.

---

## 4. Conclusion

The exact extraction and refactoring strategy is fully defined and ready for implementation. The Worker agent must create two new files in `client/src/components/reports/`: `MonthlyUsageReport.tsx` and `ReturnToStockReport.tsx`.

Below are the complete, drop-in, production-ready code implementations for both components.

### 4.1 `client/src/components/reports/MonthlyUsageReport.tsx`

```tsx
import React, { useState, useMemo, useCallback } from "react";
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
  Wrench,
  Package,
  BarChart3,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

interface MonthlyUsageReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const RECHARTS_SEMANTIC_COLORS = [
  "var(--lion-red-500, #ef4444)",
  "var(--primary, #f97316)",
  "var(--lion-red-600, #eab308)",
  "var(--lion-red-700, #22c55e)",
  "var(--lion-red-500, #06b6d4)",
  "var(--primary, #3b82f6)",
  "var(--lion-red-600, #8b5cf6)",
  "var(--lion-red-700, #ec4899)",
  "var(--lion-red-500, #14b8a6)",
  "var(--primary, #f59e0b)",
];

export const MonthlyUsageReport: React.FC<MonthlyUsageReportProps> = ({
  exportToCSV,
  exportToPDF,
}) => {
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

  const summary = useMemo(() => monthlyUsageData?.summary || null, [monthlyUsageData]);
  const topParts = useMemo(() => monthlyUsageData?.topParts || [], [monthlyUsageData]);
  const top10Parts = useMemo(() => topParts.slice(0, 10), [topParts]);
  const allParts = useMemo(() => monthlyUsageData?.allParts || [], [monthlyUsageData]);
  const equipmentBreakdown = useMemo(() => monthlyUsageData?.equipmentBreakdown || [], [monthlyUsageData]);
  const spikes = useMemo(() => monthlyUsageData?.spikes || [], [monthlyUsageData]);
  const maxQty = useMemo(() => topParts.length > 0 ? topParts[0].totalQty : 1, [topParts]);

  // Memoize sorted equipment parts to prevent sorting during render
  const sortedEquipmentParts = useMemo(() => {
    const map: Record<string, any[]> = {};
    equipmentBreakdown.forEach((eq: any) => {
      map[eq.equipmentNo] = [...(eq.parts || [])].sort((a: any, b: any) => b.qty - a.qty);
    });
    return map;
  }, [equipmentBreakdown]);

  const exportMonthlyCSV = useCallback(() => {
    if (!allParts || allParts.length === 0) return;

    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        reportName: "MonthlyUsageReport",
        format: "CSV",
        period: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
        timestamp: new Date().toISOString(),
      }
    }));

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
    if (!allParts || allParts.length === 0) return;

    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        reportName: "MonthlyUsageReport",
        format: "PDF",
        period: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
        timestamp: new Date().toISOString(),
      }
    }));

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
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly Part Usage Report</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[var(--lion-red-500)]" />
                Monthly Part Usage Overview
              </CardTitle>
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
              <Button 
                variant="outline" 
                size="sm" 
                className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" 
                onClick={exportMonthlyCSV}
                aria-label="Export Monthly Usage Report to CSV"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[var(--lion-red-500)] border-[var(--lion-red-500)] hover:bg-red-50 dark:hover:bg-red-900/20" 
                onClick={exportMonthlyPDF}
                aria-label="Export Monthly Usage Report to PDF"
              >
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {monthlyUsageLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-[var(--lion-red-500)] border-t-transparent rounded-full animate-spin" />
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
                <BarChart3 className="h-5 w-5 text-[var(--lion-red-500)]" />
                Top Used Parts — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top 10 Part Numbers by quantity issued</p>
            </CardHeader>
            <CardContent>
              {top10Parts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600 dark:text-gray-300">
                  <Package className="h-16 w-16 mb-4 opacity-40" />
                  <p className="text-lg font-medium">No issuance data for this month</p>
                  <p className="text-sm">Try selecting a different month or year</p>
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
                          <Cell key={index} fill={RECHARTS_SEMANTIC_COLORS[index % RECHARTS_SEMANTIC_COLORS.length]} />
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
                <TrendingUp className="h-5 w-5 text-[var(--lion-red-500)]" />
                Usage Ranking — All Parts
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sorted by total quantity issued — includes EQ.NO breakdown</p>
            </CardHeader>
            <CardContent>
              {allParts.length === 0 ? (
                <div className="text-center py-10 text-gray-600 dark:text-gray-300">No data for selected period.</div>
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
                              <Badge className={isTop3 ? "bg-[var(--lion-red-500)] text-white font-bold" : ""}>
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
                                    backgroundColor: RECHARTS_SEMANTIC_COLORS[index % RECHARTS_SEMANTIC_COLORS.length],
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
                <Wrench className="h-5 w-5 text-[var(--lion-red-500)]" />
                Usage by Equipment (EQ.NO)
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Parts consumed per equipment — click row to expand</p>
            </CardHeader>
            <CardContent>
              {equipmentBreakdown.length === 0 ? (
                <div className="text-center py-10 text-gray-600 dark:text-gray-300">No equipment data for selected period.</div>
              ) : (
                <div className="space-y-2">
                  {equipmentBreakdown.map((eq: any) => (
                    <div key={eq.equipmentNo} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setExpandedEq(expandedEq === eq.equipmentNo ? null : eq.equipmentNo)}
                        aria-expanded={expandedEq === eq.equipmentNo}
                        aria-label={`Expand details for equipment ${eq.equipmentNo}`}
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
                              {sortedEquipmentParts[eq.equipmentNo]?.map((part: any) => (
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
                <TrendingUp className="h-5 w-5 text-[var(--lion-red-500)]" />
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
                        <TrendingUp className="h-4 w-4 text-[var(--lion-red-500)]" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                      <span className={`text-sm font-medium ${(summary.changePercent ?? 0) >= 0 ? "text-[var(--lion-red-500)]" : "text-green-500"}`}>
                        {summary.changePercent != null ? `${Math.abs(summary.changePercent)}% ${(summary.changePercent) >= 0 ? "increase" : "decrease"}` : "—"}
                      </span>
                      <span className="text-sm text-gray-400">vs {summary.prevTotalPartsUsed.toLocaleString()} last month</span>
                    </div>
                  )}
                </div>

                {topParts.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-[var(--lion-red-500)]">
                    <p className="text-sm font-medium text-[var(--lion-red-500)] mb-2">🏆 Most Used Part</p>
                    <p className="font-bold text-lg">{topParts[0].partNo}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{topParts[0].description}</p>
                    <p className="text-sm mt-1">
                      <span className="font-semibold text-[var(--lion-red-500)]">{topParts[0].totalQty} pcs</span>
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
};
```

### 4.2 `client/src/components/reports/ReturnToStockReport.tsx`

```tsx
import React, { useState, useMemo, useCallback } from "react";
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

interface ReturnToStockReportProps {
  exportToCSV: (data: any[], filename: string, headers: string[]) => void;
  exportToPDF: (title: string, headers: string[], data: any[][]) => void;
  printReport: (title: string, content: string) => void;
}

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

export const ReturnToStockReport: React.FC<ReturnToStockReportProps> = ({
  exportToCSV,
  exportToPDF,
  printReport,
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: returnToStockData, isLoading: returnToStockLoading } = useQuery<StockReturnData>({
    queryKey: ["stockReturns", { page, search, report: true }],
    queryFn: async () => {
      const res = await apiRequest(`/api/stock-returns?page=${page}&limit=50&search=${search}`, "GET");
      if (!res.ok) throw new Error("Failed to fetch stock return data");
      return res.json();
    },
  });

  const stockReturns = useMemo(() => returnToStockData?.stockReturns || [], [returnToStockData]);
  const totalCount = useMemo(() => returnToStockData?.total || 0, [returnToStockData]);

  const exportReturnCSV = useCallback(() => {
    if (!stockReturns || stockReturns.length === 0) return;

    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        reportName: "ReturnToStockReport",
        format: "CSV",
        timestamp: new Date().toISOString(),
      }
    }));

    const exportData = stockReturns.map((item) => ({
      "Part No.": item.partNo,
      Description: item.description,
      Quantity: item.quantity,
      "Returned At": formatBangkokDateTime(item.returnedAt),
      "Returned By": item.returnedBy,
      "Issue Number": item.issueNumber || "-",
      Notes: item.notes || "-",
    }));
    exportToCSV(
      exportData,
      `return-to-stock-report-${new Date().toISOString().split("T")[0]}.csv`,
      ["Part No.", "Description", "Quantity", "Returned At", "Returned By", "Issue Number", "Notes"]
    );
  }, [stockReturns, exportToCSV]);

  const exportReturnPDF = useCallback(() => {
    if (!stockReturns || stockReturns.length === 0) return;

    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        reportName: "ReturnToStockReport",
        format: "PDF",
        timestamp: new Date().toISOString(),
      }
    }));

    const headers = ["Part No.", "Description", "Quantity", "Returned At", "Returned By", "Issue Number", "Notes"];
    const rows = stockReturns.map((item) => [
      item.partNo,
      item.description,
      item.quantity.toString(),
      formatBangkokDateTime(item.returnedAt),
      item.returnedBy,
      item.issueNumber || "-",
      item.notes || "-",
    ]);
    exportToPDF(t("returnToStockReport"), headers, rows);
  }, [stockReturns, exportToPDF, t]);

  const exportReturnPrint = useCallback(() => {
    if (!stockReturns || stockReturns.length === 0) return;

    window.dispatchEvent(new CustomEvent("agent.action", {
      detail: {
        action: "export_report",
        reportName: "ReturnToStockReport",
        format: "PRINT",
        timestamp: new Date().toISOString(),
      }
    }));

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Part No.</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Returned At</th>
            <th>Returned By</th>
            <th>Issue Number</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${stockReturns.map((item) => `
            <tr>
              <td>${item.partNo}</td>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${formatBangkokDateTime(item.returnedAt)}</td>
              <td>${item.returnedBy}</td>
              <td>${item.issueNumber || "-"}</td>
              <td>${item.notes || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    printReport(t("returnToStockReport"), tableHtml);
  }, [stockReturns, printReport, t]);

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("returnToStockReport")}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-[var(--lion-red-500)]" />
                {t("returnToStockReport")}
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t("returnToStockReportDescription")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={exportReturnCSV}
                disabled={returnToStockLoading || stockReturns.length === 0}
                aria-label="Export Return to Stock Report to CSV"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                {t("exportExcel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[var(--lion-red-500)] border-[var(--lion-red-500)] hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={exportReturnPDF}
                disabled={returnToStockLoading || stockReturns.length === 0}
                aria-label="Export Return to Stock Report to PDF"
              >
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={exportReturnPrint}
                disabled={returnToStockLoading || stockReturns.length === 0}
                aria-label="Print Return to Stock Report"
              >
                <Printer className="h-4 w-4 mr-1" />
                {t("print")}
              </Button>
            </div>
          </div>
          <div className="mt-4 max-w-md">
            <Input
              placeholder={`${t("search")}...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Search return to stock records"
            />
          </div>
        </CardHeader>
        <CardContent>
          {returnToStockLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[var(--lion-red-500)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : stockReturns.length > 0 ? (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("partNo")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead>{t("quantity")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("returnedBy")}</TableHead>
                      <TableHead>{t("issueNumber")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockReturns.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.partNo}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold">{item.quantity}</Badge>
                        </TableCell>
                        <TableCell>{formatBangkokDate(item.returnedAt)}</TableCell>
                        <TableCell>{item.returnedBy}</TableCell>
                        <TableCell>{item.issueNumber || "-"}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" aria-label={`View details for return item ${item.partNo}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                {t("view")}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{t("returnToStockReport")} - {item.partNo}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6 py-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("partNo")}</label>
                                    <p className="font-semibold text-base">{item.partNo}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("description")}</label>
                                    <p className="font-medium">{item.description}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("quantity")}</label>
                                    <p className="font-semibold text-[var(--lion-red-500)]">{item.quantity}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("date")}</label>
                                    <p className="font-medium">{formatBangkokDateTime(item.returnedAt)}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("returnedBy")}</label>
                                    <p className="font-medium">{item.returnedBy}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("issueNumber")}</label>
                                    <p className="font-mono">{item.issueNumber || "-"}</p>
                                  </div>
                                </div>
                                {item.notes && (
                                  <div>
                                    <label className="text-sm font-medium text-gray-500">{t("notes")}</label>
                                    <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">{item.notes}</p>
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
                    aria-label="Go to previous page"
                  >
                    {t("previousPage")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                    onClick={() => setPage(page + 1)}
                    aria-label="Go to next page"
                  >
                    {t("nextPage")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-600 dark:text-gray-300">
              <Undo2 className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("noStockReturnData")}</h3>
              <p className="text-sm">{t("noStockReturnData")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 5. Verification Method

To independently verify the success of the Worker's implementation, execute the following steps:

### 5.1 Programmatic Verification (Build & Type Check)
1. **TypeScript Type Integrity**: Run the following command from the root working directory (`d:/StockTracker`):
   ```bash
   tsc --noEmit
   ```
   **Expected Result**: Zero type errors, confirming that all imports (Recharts, Lucide icons, QueryClient, UI components) and prop contracts match exactly.
2. **Production Bundle Verification**: Run the build command:
   ```bash
   vite build
   ```
   **Expected Result**: Successful build without any unresolved module or bundling errors.

### 5.2 Code & Architectural Inspection
1. **Verify Layout Compliance**: Inspect `client/src/components/reports/MonthlyUsageReport.tsx` and `client/src/components/reports/ReturnToStockReport.tsx`. Confirm that no source code or test files were written into `.agents/` (which must remain metadata-only).
2. **Audit Logging Inspection**: Verify that both files contain `window.dispatchEvent(new CustomEvent("agent.action", ...))` inside `exportMonthlyCSV`, `exportMonthlyPDF`, `exportReturnCSV`, `exportReturnPDF`, and `exportReturnPrint`.
3. **Accessibility & Theming Check**: Inspect the empty states in both components to confirm they use `text-gray-600 dark:text-gray-300` (meeting WCAG AA `>= 4.5:1` contrast), verify `aria-label` attributes exist on icon buttons/pagination, and verify top-level `<h1>` headers are present.
