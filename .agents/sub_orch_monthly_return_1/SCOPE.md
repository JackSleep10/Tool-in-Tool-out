# Scope: Milestone 3 — MonthlyUsage & ReturnToStock Reports

## Architecture
- Extract `MonthlyUsageReport` and `ReturnToStockReport` components from `client/src/components/reports/reports.tsx` into dedicated files `client/src/components/reports/MonthlyUsageReport.tsx` and `client/src/components/reports/ReturnToStockReport.tsx`.
- Ensure the missing `ReturnToStockReport` JSX block is fully implemented and rendered correctly.
- Implement `useMemo` for heavy data transformations, sorting, and slicing.
- Implement `useCallback` for export handlers (`exportToCSV`, `exportToPDF`).
- Integrate client-side audit event dispatching (`agent.action`, `export_report`) on export.
- Replace hardcoded Recharts hex colors with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons and pagination controls. Ensure empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 3.1 | Exploration & Strategy | Investigate `reports.tsx` to identify exact code blocks for MonthlyUsage and ReturnToStock reports | none | PLANNED |
| 3.2 | Implementation & Verification | Create `MonthlyUsageReport.tsx` and `ReturnToStockReport.tsx` (including missing JSX block), verify `tsc --noEmit` and `vite build` | M3.1 | PLANNED |
| 3.3 | Review & Audit | Reviewer verification, Challenger empirical check, Forensic Auditor integrity verification | M3.2 | PLANNED |

## Interface Contracts
- Components must be exported cleanly for future import by `reports.tsx`.
- Do NOT modify `reports.tsx` in this milestone.
