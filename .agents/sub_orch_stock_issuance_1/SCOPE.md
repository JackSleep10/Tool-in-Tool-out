# Scope: Milestone 1 — StockBalance & Issuance Reports

## Architecture
- Extract `StockBalanceReport` and `IssuanceReport` components from `client/src/components/reports/reports.tsx` (found at `client/src/pages/reports.tsx`) into dedicated files `client/src/components/reports/StockBalanceReport.tsx` and `client/src/components/reports/IssuanceReport.tsx`.
- Implement `useMemo` for heavy data transformations, sorting, and slicing.
- Implement `useCallback` for export handlers (`exportToCSV`, `exportToPDF`).
- Integrate client-side audit event dispatching (`agent.action`, `export_report`) on export.
- Replace hardcoded Recharts hex colors with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons and pagination controls. Ensure empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1.1 | Exploration & Strategy | Investigate `reports.tsx` to identify exact code blocks for StockBalance and Issuance reports | none | DONE |
| 1.2 | Implementation & Verification | Create `StockBalanceReport.tsx` and `IssuanceReport.tsx`, verify `tsc --noEmit` and `vite build` | M1.1 | DONE |
| 1.3 | Review & Audit | Reviewer verification, Challenger empirical check, Forensic Auditor integrity verification | M1.2 | IN_PROGRESS: b6c61c23, 3cfd63fe, bee9ac8a, fcae7b16, 62fded51 |

## Interface Contracts
- Components must be exported cleanly for future import by `reports.tsx`.
- Do NOT modify `reports.tsx` in this milestone.
