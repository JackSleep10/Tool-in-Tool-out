# Project: StockTracker Inventory Reports Refactoring & Optimization

## Architecture
- Module/package boundaries: `client/src/pages/reports.tsx` as parent tab container and 6 sub-report components in `client/src/components/reports/` (`StockBalanceReport.tsx`, `IssuanceReport.tsx`, `ReceivingReport.tsx`, `ConsumableReport.tsx`, `MonthlyUsageReport.tsx`, `ReturnToStockReport.tsx`).
- Data flow: Parent `reports.tsx` manages active tab state and renders the corresponding sub-report component. Each sub-report component fetches or receives data, memoizes heavy transformations via `useMemo`, memoizes export handlers via `useCallback`, and dispatches audit logs on export.
- Shared interfaces: Export actions dispatch client-side audit events (`agent.action`, `export_report`). All UI components adhere to WCAG AA contrast ratios (>= 4.5:1), semantic CSS variables for Recharts, Tailwind theme variables (`--lion-red-500`, `--primary`), and include `aria-label` attributes for accessibility.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | StockBalance & Issuance Reports | Create `StockBalanceReport.tsx` and `IssuanceReport.tsx`, implement memoization, audit logging, theming/a11y | none | IN_PROGRESS |
| 2 | Receiving & Consumable Reports | Create `ReceivingReport.tsx` and `ConsumableReport.tsx`, implement memoization, audit logging, theming/a11y | none | IN_PROGRESS |
| 3 | MonthlyUsage & ReturnToStock Reports | Create `MonthlyUsageReport.tsx` and `ReturnToStockReport.tsx`, implement missing ReturnToStock JSX block, memoization, audit logging, theming/a11y | none | IN_PROGRESS |
| 4 | Parent Container Integration | Refactor `reports.tsx` to import and render sub-reports, verify tab switching and a11y | M1, M2, M3 | PLANNED |
| 5 | E2E Testing Track | Design & implement opaque-box E2E test suite (Tiers 1-4) for reports page, publish TEST_READY.md | none | IN_PROGRESS |
| 6 | Final Milestone | Phase 1: Pass 100% E2E tests (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5) | M4, M5 | PLANNED |

## Interface Contracts
### `reports.tsx` ↔ Sub-Report Components
- Each sub-report component is a React functional component exported from its respective file in `client/src/components/reports/`.
- Props: Clean interface depending on data requirements of each sub-report.
- Audit Logging: Client-side event dispatching (`agent.action`, `export_report`) on CSV/PDF export.

## Code Layout
- `client/src/pages/reports.tsx`: Parent tab container
- `client/src/components/reports/StockBalanceReport.tsx`: Stock balance sub-report
- `client/src/components/reports/IssuanceReport.tsx`: Issuance sub-report
- `client/src/components/reports/ReceivingReport.tsx`: Receiving sub-report
- `client/src/components/reports/ConsumableReport.tsx`: Consumable sub-report
- `client/src/components/reports/MonthlyUsageReport.tsx`: Monthly usage sub-report
- `client/src/components/reports/ReturnToStockReport.tsx`: Return to stock sub-report
