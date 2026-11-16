# Scope: Milestone 2 — Receiving & Consumable Reports

## Architecture
- Extract `ReceivingReport` and `ConsumableReport` components from `client/src/components/reports/reports.tsx` into dedicated files `client/src/components/reports/ReceivingReport.tsx` and `client/src/components/reports/ConsumableReport.tsx`.
- Implement `useMemo` for heavy data transformations, sorting, and slicing.
- Implement `useCallback` for export handlers (`exportToCSV`, `exportToPDF`).
- Integrate client-side audit event dispatching (`agent.action`, `export_report`) on export.
- Replace hardcoded Recharts hex colors with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons and pagination controls. Ensure empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 2.1 | Exploration & Strategy | Investigate `reports.tsx` to identify exact code blocks for Receiving and Consumable reports | none | PLANNED |
| 2.2 | Implementation & Verification | Create `ReceivingReport.tsx` and `ConsumableReport.tsx`, verify `tsc --noEmit` and `vite build` | M2.1 | PLANNED |
| 2.3 | Review & Audit | Reviewer verification, Challenger empirical check, Forensic Auditor integrity verification | M2.2 | PLANNED |

## Interface Contracts
- Components must be exported cleanly for future import by `reports.tsx`.
- Do NOT modify `reports.tsx` in this milestone.
