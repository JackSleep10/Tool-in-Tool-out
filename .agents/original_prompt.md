## 2026-06-28T00:16:38Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Refactor and fix the inventory reports page (`reports.tsx`) to resolve critical missing JSX blocks, optimize performance via memoization, enforce accessibility/theming standards, and integrate audit logging for report exports.

Working directory: d:/StockTracker
Integrity mode: development

## Requirements

### R1. Component Architecture & Splitting
Split the monolithic `reports.tsx` (2,240 lines) into dedicated sub-report components within `client/src/components/reports/` (`StockBalanceReport.tsx`, `IssuanceReport.tsx`, `ReceivingReport.tsx`, `ConsumableReport.tsx`, `MonthlyUsageReport.tsx`, `ReturnToStockReport.tsx`). Ensure the missing `ReturnToStockReport` JSX block is fully implemented and rendered correctly when active.

### R2. Performance Optimization (Memoization)
Implement `useMemo` for all heavy data transformations, sorting, and slicing (e.g., `allParts`, `topParts`, `equipmentBreakdown`). Implement `useCallback` for all export handlers (`exportToCSV`, `exportToPDF`) to prevent unnecessary function recreation across renders.

### R3. Governance & Audit Logging
Integrate client-side audit event dispatching (`agent.action`, `export_report`) when users export reports to CSV or PDF, ensuring robust traceability in line with `agent-audit-logging` standards.

### R4. Theming & Accessibility (a11y)
Replace hardcoded Recharts hex colors (`BAR_COLORS`) with semantic CSS variables. Replace generic Tailwind classes with theme variables (`--lion-red-500`, `--primary`). Add missing `aria-label` attributes to icon buttons, pagination controls, and tabs. Ensure all empty states satisfy WCAG AA contrast ratios (>= 4.5:1) and add a clear `<h1>` heading.

## Acceptance Criteria

### Programmatic Verification (TypeScript & Build Quality)
- [ ] `tsc --noEmit` passes cleanly across the entire client project without any missing imports or type mismatches.
- [ ] `vite build` successfully produces a valid production bundle without errors.

### Functional Verification
- [ ] Clicking the `return-to-stock-report` tab successfully renders the Return to Stock Report table UI rather than a blank screen.
- [ ] `reports.tsx` acts cleanly as a parent tab container, delegating all sub-report rendering to the new components in `client/src/components/reports/`.
