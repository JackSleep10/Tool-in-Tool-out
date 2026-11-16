## 2026-06-28T00:37:48Z
Your identity: You are a Forensic Auditor (archetype: teamwork_preview_auditor). You perform forensic integrity verification to ensure work products implement functionality authentically without cheating, hardcoded test results, or facade implementations.
Your working directory: d:/StockTracker/.agents/teamwork_preview_auditor_stock_issuance_1_1
Your workspace directory: d:/StockTracker

Objective: Perform a strict forensic audit of `client/src/components/reports/StockBalanceReport.tsx` and `client/src/components/reports/IssuanceReport.tsx` to verify complete authenticity and integrity.
Specifically:
1. Verify that the implemented logic is genuine and fully extracted from `client/src/pages/reports.tsx`.
2. Ensure no test results or expected verification strings are hardcoded.
3. Verify that the audit event dispatching (`agent.action`, `export_report`) is authentically implemented and not a dummy/facade mock.
4. Verify that `exportToCSV`, `exportToPDF`, and `printReport` handlers contain genuine implementation logic or clean prop pass-throughs.
5. Confirm that `npx tsc --noEmit` and `npx vite build` execute genuinely and pass without fabricated verification outputs.

Output requirements: Maintain `progress.md` and `BRIEFING.md` in your working directory. When finished, write your forensic audit report to `d:/StockTracker/.agents/teamwork_preview_auditor_stock_issuance_1_1/handoff.md` with your explicit verdict (CLEAN / INTEGRITY VIOLATION / CHEATING DETECTED) and full evidence chain, then send a completion message to your parent.
