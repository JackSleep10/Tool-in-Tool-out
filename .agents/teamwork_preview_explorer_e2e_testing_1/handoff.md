# E2E Testing Infrastructure Exploration Report

## 1. Observation
During our read-only exploration of the repository to identify existing testing setups and determine the best E2E test runner configuration for opaque-box testing of the inventory reports page, we directly observed the following:

- **Root `package.json` (`d:/StockTracker/package.json`)**:
  - Contains full project dependencies and scripts for both frontend (React/Vite) and backend (Express/Drizzle/Postgres).
  - Existing scripts (lines 6-19): `"dev": "nodemon --watch './**/*.ts' --exec tsx server/index.ts"`, `"build": "tsc && vite build"`, `"start": "cross-env NODE_ENV=production node dist/server/index.js"`, `"check": "tsc"`, `"db:push": "drizzle-kit push"`, etc.
  - No testing frameworks (e.g., Playwright, Cypress, Vitest, Puppeteer, Jest) are present in `dependencies` (lines 29-113) or `devDependencies` (lines 114-142).
  - No automated test runner scripts are defined in `scripts`.

- **Client `package.json` (`d:/StockTracker/client/package.json`)**:
  - `view_file` returned `The system cannot find the file specified.` Confirming this is a single root-level `package.json` setup where client and server share the root configuration.

- **Vite Configuration (`d:/StockTracker/vite.config.ts`)**:
  - Uses `@vitejs/plugin-react` (line 25).
  - Configures `root: path.resolve(__dirname, "client")` (line 37) and `build.outDir: path.resolve(__dirname, "dist/public")` (line 39).
  - Development server port is configured to `3000` (line 53).

- **TypeScript Configuration (`d:/StockTracker/tsconfig.json`)**:
  - `include` covers `["client/src/**/*", "shared/**/*", "server/**/*"]` (line 2).
  - `exclude` specifically excludes `**/*.test.ts` (line 3), indicating that test files are kept separate from the main production TypeScript build.

- **Existing Test Directories & Files**:
  - Running `find_by_name` for `*test*` (excluding `node_modules`, `.agents`, `dist`, `.git`) located exactly one file: `scripts/test-db.js`.
  - Inspecting `scripts/test-db.js` revealed it is a standalone script for testing Neon database connection (`SELECT version()`), unrelated to frontend or E2E testing.
  - No other test files or directories exist in the repository.

- **Server Entry Point (`d:/StockTracker/server/index.ts`)**:
  - Integrates Vite dev server middleware in development mode (`if (process.env.NODE_ENV === "development") { await setupVite(app, server); }` on line 153).
  - Server listens on port `3000` by default (`const port = parseInt(process.env.PORT || "3000", 10);` on line 160).

- **E2E Testing Scope & Requirements (`ORIGINAL_REQUEST.md`, `PROJECT.md`, `SCOPE.md`)**:
  - `ORIGINAL_REQUEST.md`: Focuses on refactoring `reports.tsx` into 6 sub-report components (`StockBalanceReport`, `IssuanceReport`, `ReceivingReport`, `ConsumableReport`, `MonthlyUsageReport`, `ReturnToStockReport`). Functional verification requires verifying tab switching, ensuring `ReturnToStockReport` renders correctly, and verifying parent container delegation.
  - `PROJECT.md` & `SCOPE.md`: Mandate a requirement-driven, opaque-box E2E test suite organized into 4 systematic tiers: Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases), Tier 3 (Cross-Feature Combinations), and Tier 4 (Real-World Application Scenarios).

## 2. Logic Chain
1. **Absence of Existing E2E Framework**: The complete lack of any test runner packages in `package.json` and the absence of existing test suites means we have a clean slate to select the most robust, industry-standard tool for opaque-box E2E testing without legacy conflicts.
2. **Alignment with Opaque-Box Testing**: `SCOPE.md` explicitly requires opaque-box testing without internal module dependencies. Playwright (`@playwright/test`) is uniquely suited for this as it interacts with the application strictly from an external browser perspective (via accessibility locators, tab clicks, and network interception/observation).
3. **Seamless Web Server Lifecycle Management**: Because `server/index.ts` serves both the Express API and the Vite frontend on port 3000 in development mode (`npm run dev`), Playwright's built-in `webServer` configuration can automatically launch the full stack, wait for `http://localhost:3000`, execute the tests, and tear down the server cleanly.
4. **TypeScript Compatibility & Isolation**: `tsconfig.json` excludes `**/*.test.ts`. Playwright natively compiles and executes TypeScript test files (`.spec.ts`) out of the box without requiring modifications to the application's root `tsconfig.json`. Placing E2E tests in a dedicated `e2e/` root directory ensures complete isolation from `client/src/` internals.
5. **Support for Tiers 1-4**: Playwright's powerful file structuring, tagging, and project configuration capabilities naturally support dividing the test suite into the 4 required tiers (`tier1_feature_coverage.spec.ts`, `tier2_boundary_corner.spec.ts`, `tier3_cross_feature.spec.ts`, `tier4_real_world.spec.ts`).

## 3. Caveats
- **Authentication / Database State**: The E2E tests will run against the local development server (`npm run dev`). Depending on the local database configuration (Neon serverless or local Postgres), test scripts may need to account for initial database seeding or mock API responses (`page.route()`) if a live database connection is not fully populated in the test environment.
- **Operating System / Browser Binaries**: Running Playwright requires downloading browser binaries (`npx playwright install`). In restricted CI or local environments, ensuring these binaries are available or configuring Playwright to use system browsers (e.g., `channel: 'chrome'`) may be necessary.

## 4. Conclusion
We recommend adopting **Playwright (`@playwright/test`)** as the official E2E test runner for the StockTracker repository. It perfectly satisfies all requirements for opaque-box testing, automatic server management, TypeScript support, and systematic 4-tier organization.

### Recommended Setup & Configuration
1. **Package Installation**:
   ```bash
   npm install -D @playwright/test
   npx playwright install --with-deps
   ```
2. **`package.json` Script Addition**:
   ```json
   "scripts": {
     "test:e2e": "playwright test",
     "test:e2e:ui": "playwright test --ui"
   }
   ```
3. **Playwright Config (`d:/StockTracker/playwright.config.ts`)**:
   ```typescript
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     timeout: 60000,
     expect: { timeout: 10000 },
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',
     use: {
       baseURL: 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
     },
     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
     ],
     webServer: {
       command: 'npm run dev',
       url: 'http://localhost:3000',
       reuseExistingServer: !process.env.CI,
       timeout: 120000,
     },
   });
   ```
4. **E2E File Structure**:
   ```
   d:/StockTracker/
   ├── e2e/
   │   ├── tier1_feature_coverage.spec.ts   # Sub-report tab switching & ReturnToStock render checks
   │   ├── tier2_boundary_corner.spec.ts    # Empty states, WCAG AA contrast, h1 headers, pagination limits
   │   ├── tier3_cross_feature.spec.ts      # Rapid tab switching, filter + export combinations
   │   └── tier4_real_world.spec.ts         # Audit log verification (`export_report`), full user workflows
   ├── playwright.config.ts
   └── package.json
   ```

## 5. Verification Method
To independently verify the exploration findings and prepare for the runner installation:
1. **Inspect `package.json`**:
   ```bash
   cat package.json
   ```
   *Validation*: Confirm no existing E2E testing frameworks (e.g., Playwright, Cypress) or conflicting `test:e2e` scripts are present.
2. **Verify Server Execution Port**:
   ```bash
   cat server/index.ts | grep PORT
   ```
   *Validation*: Confirm the server defaults to port `3000`.
3. **Test Setup Execution (Post-Installation)**:
   ```bash
   npx playwright test
   ```
   *Validation*: Once implemented, Playwright will successfully boot `npm run dev`, execute tests in `e2e/`, and produce a clean test report without modifying application source code.
