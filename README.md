# TradeDocs Navigator

A React/TypeScript frontend and Express API for invoices, UBL despatch advice and shipment tracking, backed by PostgreSQL. Production serves the frontend and API from the same origin; no separate frontend hosting or CORS configuration is needed.

## Requirements

- Node.js 22 or 24 (see `.nvmrc`)
- PostgreSQL 14+ or Docker
- Java 17+ for UBL invoice schema validation (`java` and `javac` on PATH)

## Local development

```sh
npm ci
npm ci --prefix frontend
cp .env.example .env
# Start the development database, unless you already have PostgreSQL running.
docker compose up -d db
# Apply the versioned migrations. Startup also applies pending migrations.
npm run db:migrate
npm run dev
```

In a second terminal:

```sh
npm --prefix frontend run dev
```

Open Vite's local address, normally http://127.0.0.1:5173. Its `/api` proxy targets the local backend at port 3000, not an old hosted backend. To change the backend target, set `API_PROXY_TARGET` when starting Vite. If port 5432 is occupied, change the compose port mapping and the connection URL in `.env`, or connect to your existing development database.

Register your own account. There are no shared default credentials or fabricated production documents.

To run the built application from Express:

```sh
npm run build
npm start
```

Open http://localhost:3000. React routes survive reloads and direct links. The application refuses to start if migrations fail, rather than accepting traffic against an unavailable database.

## Railway production

The configured application is **robust-tranquility / production / TradeDocNavigator**. A separate PostgreSQL service named **Postgres** supplies its database.

1. Deploy this repository from its root using the committed `Dockerfile`. Deployment settings are managed in `.railway/railway.ts`. The multi-stage build compiles the frontend and installs the Java validator.
2. Set application variable `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` so it uses the database's private-network connection. Do not put a database password in source control.
3. Set `NODE_ENV=production`. Set `PORT=8080` to match the existing Railway domain's target port, or keep the app port and domain target aligned if you change them.
4. Startup runs migrations under a database advisory lock, then begins listening. Railway checks `/api/health`, which verifies a database query.
5. The public application is https://tradedocnavigator.up.railway.app.

Deployment settings use Railway Infrastructure as Code because `railway.json` is deprecated. To change infrastructure settings, use Node.js 22+ and run `npx @railway/cli config plan`, review the diff, then `npx @railway/cli config apply`. The named partial owns only TradeDocNavigator; database resources and existing service variables remain managed on Railway. Ordinary pushes to `main` still deploy the app after CI passes.

The database needs a persistent Railway volume. Use Railway's PostgreSQL template, and enable database backups according to your retention needs. No public database endpoint is required by the application.

The connection supports `DATABASE_URL`, PostgreSQL's `PG*` variables, or legacy `DB_*` variables. If your database requires TLS, set `DATABASE_SSL=true`; certificate verification stays enabled. A private Railway connection does not require enabling this variable.

## Features and integration limits

- **Accounts:** email/password registration, bcrypt hashes, opaque sessions stored as hashes, seven-day expiry, HttpOnly cookies, sign-out and server-side access checks. Documents belong to the account that created them.
- **Invoices:** list/search, create from item details or UBL Order XML, detail view, edit date/currency/payable amount and download UBL 2.1 XML. Totals use the persisted invoice amount everywhere. An imported/edited total that differs from the line total is exported as an explicit allowance or charge.
- **XML validation:** checks the UBL 2.1 Invoice XSD. It **does not certify Peppol, Australian tax or e-invoicing compliance**. Generated invoices are general UBL documents; add jurisdiction-specific business validation before using them for regulated e-invoicing.
- **Despatch advice:** store all line items and actual destination details, search/view/download UBL XML, remove and undo removal. `Prepared` is a document status, not a live carrier status. This implementation uses this application's database rather than the old unauthenticated third-party despatch service.
- **Tracking:** save/deduplicate carrier references per account, register a tracker with TrackShip and retrieve status/events. The default demo mode advances saved shipments through four simulated delivery stages, with clearly labelled event history. It makes no paid carrier requests.

### Tracking demo and optional live updates

`TRACKING_MODE=demo` enables the free simulation. Each **Advance demo** click moves to the next stage: received, in transit, out for delivery, delivered. Completed demos stay delivered. These are simulated records, never real carrier reports. Set `TRACKING_MODE=disabled` to use saved references without updates.

For real carrier tracking, set `TRACKING_MODE=live`.

Set `TRACKSHIP_API_KEY` and `TRACKSHIP_APP_NAME` on the **backend Railway service**. The app name must match the custom app connected in your TrackShip account. `APP_NAME` is accepted as a legacy fallback. The API key is never sent to the browser.

Use a carrier identifier supported by TrackShip, such as `ups`. Open a saved shipment's details to register it with the provider using the order reference, postal code and country. Then use **Check status**. Provider requests have timeouts and display errors without replacing saved data. Updates are fetched on demand; no webhook is required for this flow. Live external calls require a valid provider account and credentials, and may use that account's tracker allowance.

## API

All routes except health, login and registration require a valid session cookie, `Authorization: Bearer <token>` or `sessionid: <token>`. Numeric session IDs from the old prototype are not accepted. Each authenticated user can access only their own records.

| Method       | Route                                           | Purpose                                       |
| ------------ | ----------------------------------------------- | --------------------------------------------- |
| GET          | `/api/health`                                   | Database-backed readiness                     |
| POST         | `/api/v1/admin/register`, `/api/v1/admin/login` | Register/sign in                              |
| GET          | `/api/v1/admin/me`                              | Current user                                  |
| POST         | `/api/v1/admin/logout`                          | Invalidate session                            |
| GET          | `/api/v2/invoice/list?partyNameBuyer=`          | Optional buyer search; returns `{ invoices }` |
| POST         | `/api/v2/invoice/create`                        | JSON details or `application/xml` UBL order   |
| GET / PUT    | `/api/v2/invoice/:id`                           | View/edit invoice                             |
| GET          | `/api/v2/invoice/:id/xml`                       | Download invoice                              |
| POST         | `/api/v1/invoice/validate`                      | Validate `{ invoice: "XML" }`                 |
| GET / POST   | `/api/v2/despatches`                            | List/create despatch advice                   |
| GET / DELETE | `/api/v2/despatches/:id`                        | View/soft-remove                              |
| GET          | `/api/v2/despatches/:id/xml`                    | Download despatch advice                      |
| POST         | `/api/v2/despatches/:id/restore`                | Undo removal                                  |
| GET / POST   | `/api/v2/shipments`                             | List/save tracking reference                  |
| POST         | `/api/v2/shipments/:id/register`                | Register with TrackShip                       |
| POST         | `/api/v2/shipments/:id/sync`                    | Retrieve latest provider events               |

The plural invoice-list route and selected historical v1 invoice routes remain aliases to the current contract. Lists currently return up to the latest 500 records; invoice and despatch creation accept up to 100 line items. XML bodies are limited to 500 KB.

Example invoice creation payload:

```json
{
  "IssueDate": "2026-10-11",
  "PartyName": "Buyer Company",
  "CurrencyCode": "AUD",
  "Items": [
    {
      "ItemName": "Widget",
      "ItemDescription": "Blue widget",
      "ItemPrice": 10.5,
      "ItemQuantity": 2,
      "ItemUnitCode": "EA"
    }
  ]
}
```

`PayableAmount` is optional; if absent, the server calculates it from the items. All API errors use `{ "error": "message" }` and an appropriate HTTP status.

## Verification

Use a separate database whose name ends in `_test`. The tests reject other database names and clean up only their own accounts/documents. Browser test records remain in the dedicated test database for inspection.

```sh
docker compose --profile test up -d test-db
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm audit
npm audit --prefix frontend
```

The default test connection is `postgresql://tradedocs:tradedocs@127.0.0.1:55432/tradedocs_test`. Set `TEST_DATABASE_URL` to override it. `npm run test:e2e` starts its own production-asset server on port 3101; build the frontend first. CI runs lint/type/build checks, database integration tests and desktop/mobile browser journeys, and checks production dependencies for high-severity advisories.

The integration suite covers session invalidation, tenant isolation, transaction rollback, invoice totals/XML validation, order import, multi-item despatches, restore and provider-response handling. Browser tests cover registration, login errors, direct-route reloads, invoice/despatch creation/downloads, edits, removal/undo, tracking references and narrow-screen overflow.

## Database history

Machine-specific `seng_db/` PostgreSQL files and `database.db` are excluded from Git and Docker. Existing local files are preserved; the application does not read them or automatically import them. Migrations initialize a clean database. If applied to the old PostgreSQL schema, the migration adds invoice ownership and persisted totals without dropping existing tables. Historical invoice ownership is adopted only when the seller maps to exactly one account; ambiguous records require manual assignment.

The obsolete SQLite-era helpers, mocked endpoint tests and inaccurate Swagger specification have been replaced by the current PostgreSQL services, database-backed tests and API contract above. Previous implementations remain available in Git history.
