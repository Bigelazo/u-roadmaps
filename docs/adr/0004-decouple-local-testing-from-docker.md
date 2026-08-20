---
status: accepted
---

# Decouple local testing from Docker

Local development and testing will use an already-running native PostgreSQL instance so the developer's Next.js server and development data can remain available while agents run tests. Docker is reserved for production packaging and execution: `Dockerfile` and the production Compose configuration remain, while development, integration, and E2E Compose configurations are removed.

The local PostgreSQL instance hosts separate development and E2E databases configured through ignored local environment files with versioned examples. Both databases receive the same deterministic fixture dataset from one guarded source, but E2E resets only its own database once per suite. The fixture loader must reject non-local databases and any database not explicitly allowlisted for development or E2E use.

The test model has two levels. Vitest runs unit tests that require neither PostgreSQL nor Next.js. Playwright owns all tests that exercise persistence, HTTP APIs, authentication boundaries, or browser behavior; existing integration coverage migrates to Playwright rather than remaining a separate suite. E2E tests authenticate fixture users with test-secret-signed NextAuth cookies, with dedicated scenarios retaining coverage of the VTI callback, and each test must run independently from the shared fixture baseline.

Playwright compiles and serves an isolated production build on a port and Next.js output directory distinct from the developer's active server. `pnpm test:e2e` resets and migrates the E2E database, loads the shared fixtures, starts and stops only that isolated application, and never controls PostgreSQL or Docker. `pnpm test` remains the sequential full gate of type checking, unit tests, and E2E tests. Concurrent test agents, automatic PostgreSQL provisioning, CI setup, and auxiliary orchestration scripts are outside this decision.
