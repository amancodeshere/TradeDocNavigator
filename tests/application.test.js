import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import request from "supertest";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://tradedocs:tradedocs@127.0.0.1:55432/tradedocs_test";
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /(?:_test|test)$/,
  "Use a dedicated test database ending in _test.",
);
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");
const { db, transaction } = await import("../src/connect.js");
const { migrate } = await import("../scripts/migrate.js");
const { XMLParser } = await import("fast-xml-parser");
const { validateInvoiceXML } = await import("../src/services/xml.js");
const prefix = randomUUID();
let owner, outsider, invoiceId, despatchId;
const userIds = [];
const document = {
  IssueDate: "2026-10-11",
  PartyName: "Buyer & Partners",
  CurrencyCode: "AUD",
  Items: [
    {
      ItemName: "Widgets",
      ItemDescription: "Widget <large>",
      ItemPrice: 10.5,
      ItemQuantity: 2,
      ItemUnitCode: "EA",
    },
    {
      ItemName: "Liquid",
      ItemDescription: "Bulk liquid",
      ItemPrice: 4,
      ItemQuantity: 1.5,
      ItemUnitCode: "LTR",
    },
  ],
};
const auth = (operation, token = owner) => operation.set("sessionid", token);
before(async () => {
  await migrate();
  for (const name of ["owner", "outsider"]) {
    const response = await request(app)
      .post("/api/v1/admin/register")
      .send({
        companyName: `${name} ${prefix}`,
        email: `${name}-${prefix}@example.com`,
        password: "Password123",
      });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    userIds.push(response.body.user.userId);
    if (name === "owner") owner = response.body.sessionId;
    else outsider = response.body.sessionId;
  }
});
after(async () => {
  await db.query(
    "DELETE FROM orders WHERE salesorderid IN (SELECT salesorderid FROM invoices WHERE userid = ANY($1::int[]))",
    [userIds],
  );
  await db.query("DELETE FROM users WHERE userid = ANY($1::int[])", [userIds]);
  await db.end();
});
test("migrations are repeatable and health verifies PostgreSQL", async () => {
  await migrate();
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.database, "connected");
});
test("invalid credentials finish with 401 rather than hanging", async () => {
  const res = await request(app)
    .post("/api/v1/admin/login")
    .send({ email: `owner-${prefix}@example.com`, password: "wrong" })
    .timeout(5000);
  assert.equal(res.status, 401);
  assert.match(res.body.error, /incorrect/);
});
test("registration normalizes email and rejects duplicate and malformed input", async () => {
  const duplicate = await request(app)
    .post("/api/v1/admin/register")
    .send({
      companyName: "Other",
      email: `OWNER-${prefix}@example.com`,
      password: "Password123",
    });
  assert.equal(duplicate.status, 409);
  const malformed = await request(app)
    .post("/api/v1/admin/register")
    .send({ password: 123 });
  assert.equal(malformed.status, 400);
});
test("login issues an opaque token and HttpOnly cookie", async () => {
  const res = await request(app)
    .post("/api/v1/admin/login")
    .send({ email: `owner-${prefix}@example.com`, password: "Password123" });
  assert.equal(res.status, 200);
  assert.match(res.body.sessionId, /^[a-f0-9]{64}$/);
  assert.match(res.headers["set-cookie"][0], /HttpOnly/);
  const me = await request(app)
    .get("/api/v1/admin/me")
    .set("Cookie", res.headers["set-cookie"]);
  assert.equal(me.body.user.userId, userIds[0]);
});
test("numeric session IDs and unauthenticated requests cannot access documents", async () => {
  assert.equal((await request(app).get("/api/v2/invoice/list")).status, 401);
  assert.equal(
    (await request(app).get("/api/v2/invoice/list").set("sessionid", "1"))
      .status,
    401,
  );
});
test("cross-origin writes are rejected", async () => {
  const res = await auth(request(app).post("/api/v2/invoice/create"))
    .set("Origin", "https://evil.example")
    .send(document);
  assert.equal(res.status, 403);
});
test("creates a multi-item invoice with fractional quantities and calculated total", async () => {
  const res = await auth(request(app).post("/api/v2/invoice/create")).send(
    document,
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  invoiceId = res.body.invoiceId;
  const detail = await auth(request(app).get(`/api/v2/invoice/${invoiceId}`));
  assert.equal(detail.status, 200);
  assert.equal(detail.body.amount, 27);
  assert.equal(detail.body.items.length, 2);
  assert.equal(detail.body.items[1].quantity, 1.5);
});
test("list loads without filter, filters by buyer and isolates accounts", async () => {
  const res = await auth(request(app).get("/api/v2/invoice/list"));
  assert.equal(res.body.invoices.length, 1);
  assert.equal(
    (
      await auth(
        request(app).get("/api/v2/invoices/list?partyNameBuyer=partners"),
      )
    ).body.invoices.length,
    1,
  );
  assert.equal(
    (
      await auth(
        request(app).get("/api/v2/invoice/list?partyNameBuyer=missing"),
      )
    ).body.invoices.length,
    0,
  );
  assert.equal(
    (await auth(request(app).get("/api/v2/invoice/list"), outsider)).body
      .invoices.length,
    0,
  );
  assert.equal(
    (await auth(request(app).get(`/api/v2/invoice/${invoiceId}`), outsider))
      .status,
    404,
  );
});
test("edits authoritative total and keeps list, details and XML aligned", async () => {
  const res = await auth(request(app).put(`/api/v2/invoice/${invoiceId}`)).send(
    { amount: 30.25, currencyCode: "NZD", issueDate: "2026-10-12" },
  );
  assert.equal(res.status, 200);
  const detail = await auth(request(app).get(`/api/v2/invoice/${invoiceId}`));
  assert.equal(detail.body.amount, 30.25);
  assert.equal(detail.body.currencyCode, "NZD");
  const xml = await auth(request(app).get(`/api/v2/invoice/${invoiceId}/xml`));
  assert.equal(xml.status, 200);
  assert.match(xml.headers["content-type"], /xml/);
  const parsed = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  }).parse(xml.text).Invoice;
  assert.equal(parsed.LegalMonetaryTotal.PayableAmount["#text"], 30.25);
  assert.equal(
    parsed.AccountingCustomerParty.Party.PartyName.Name,
    "Buyer & Partners",
  );
  const result = await validateInvoiceXML(xml.text);
  assert.equal(result.validated, true, result.message);
});
test("another account cannot edit or export invoices", async () => {
  assert.equal(
    (
      await auth(
        request(app).put(`/api/v2/invoice/${invoiceId}`),
        outsider,
      ).send({ amount: 100 })
    ).status,
    404,
  );
  assert.equal(
    (await auth(request(app).get(`/api/v2/invoice/${invoiceId}/xml`), outsider))
      .status,
    404,
  );
});
test("invalid dates, malformed XML, unsupported entities and invalid amounts do not create invoices", async () => {
  for (const input of [
    { ...document, IssueDate: "2026-02-30" },
    { ...document, PayableAmount: "$5" },
    { ...document, Items: [] },
    { ...document, Items: [{ ...document.Items[0], ItemQuantity: 0 }] },
  ])
    assert.equal(
      (await auth(request(app).post("/api/v2/invoice/create")).send(input))
        .status,
      400,
    );
  for (const xml of ["<Order>", '<!DOCTYPE x [<!ENTITY y "hello">]><Order/>'])
    assert.equal(
      (
        await auth(request(app).post("/api/v2/invoice/create"))
          .type("application/xml")
          .send(xml)
      ).status,
      400,
    );
});
test("imports the repository UBL order fixture", async () => {
  const xml = await readFile(
    new URL("./fixtures/order.xml", import.meta.url),
    "utf8",
  );
  const res = await auth(request(app).post("/api/v2/invoice/create"))
    .type("application/xml")
    .send(xml);
  assert.equal(res.status, 201, JSON.stringify(res.body));
});
test("transaction errors roll back rather than leaving orphan rows", async () => {
  const email = `rollback-${prefix}@example.com`;
  await assert.rejects(
    transaction(async (client) => {
      await client.query(
        "INSERT INTO users(email,password,companyname) VALUES($1,$2,$3)",
        [email, "hash", "Rollback"],
      );
      throw new Error("abort");
    }),
    /abort/,
  );
  assert.equal(
    (await db.query("SELECT * FROM users WHERE email=$1", [email])).rowCount,
    0,
  );
});
test("despatch creation retains every item, selected units and destination country", async () => {
  const res = await auth(request(app).post("/api/v2/despatches")).send({
    orderId: "ORDER-42",
    issueDate: "2026-10-11",
    supplierName: "Supplier & Co",
    customerName: "Customer",
    deliveryAddress: "1 Trade Street, Sydney",
    countryCode: "AU",
    items: [
      { itemId: "1", description: "First", quantity: 2, unit: "EA" },
      { itemId: "2", description: "Second", quantity: 1.25, unit: "LTR" },
    ],
  });
  assert.equal(res.status, 201);
  despatchId = res.body.despatchId;
  const detail = await auth(
    request(app).get(`/api/v2/despatches/${despatchId}`),
  );
  assert.equal(detail.body.items.length, 2);
  assert.equal(detail.body.items[1].unit, "LTR");
  assert.equal(detail.body.countryCode, "AU");
  const xml = await auth(
    request(app).get(`/api/v2/despatches/${despatchId}/xml`),
  );
  assert.equal(xml.status, 200);
  assert.match(xml.text, /LTR/);
  assert.match(xml.text, />AU</);
  const { default: validator } = await import("xsd-schema-validator");
  await validator.validateXML(
    xml.text,
    fileURLToPath(
      new URL(
        "../schemas/ubl/xsd/maindoc/UBL-DespatchAdvice-2.1.xsd",
        import.meta.url,
      ),
    ),
  );
});
test("despatches are isolated, removal is recoverable, restore respects ownership", async () => {
  assert.equal(
    (await auth(request(app).get(`/api/v2/despatches/${despatchId}`), outsider))
      .status,
    404,
  );
  assert.equal(
    (
      await auth(
        request(app).delete(`/api/v2/despatches/${despatchId}`),
        outsider,
      )
    ).status,
    404,
  );
  assert.equal(
    (await auth(request(app).delete(`/api/v2/despatches/${despatchId}`)))
      .status,
    200,
  );
  assert.equal(
    (await auth(request(app).get(`/api/v2/despatches/${despatchId}`))).status,
    404,
  );
  assert.equal(
    (
      await auth(
        request(app).post(`/api/v2/despatches/${despatchId}/restore`),
        outsider,
      )
    ).status,
    404,
  );
  assert.equal(
    (await auth(request(app).post(`/api/v2/despatches/${despatchId}/restore`)))
      .status,
    200,
  );
});
test("tracking references are persisted and deduplicated; unavailable integrations give a clear error", async () => {
  delete process.env.TRACKSHIP_API_KEY;
  process.env.TRACKING_MODE = "live";
  const body = { trackingNumber: "ABC123", trackingProvider: "ups" };
  const saved = await auth(request(app).post("/api/v2/shipments")).send(body);
  assert.equal(saved.status, 201);
  const again = await auth(request(app).post("/api/v2/shipments")).send(body);
  assert.equal(saved.body.shipmentId, again.body.shipmentId);
  const list = await auth(request(app).get("/api/v2/shipments"));
  assert.equal(list.body.shipments.length, 1);
  assert.equal(list.body.liveTrackingAvailable, false);
  const denied = await auth(
    request(app).post(`/api/v2/shipments/${saved.body.shipmentId}/sync`),
    outsider,
  );
  assert.equal(denied.status, 404);
  const unavailable = await auth(
    request(app).post(`/api/v2/shipments/${saved.body.shipmentId}/sync`),
  );
  assert.equal(unavailable.status, 503);
});
test("demo tracking advances four stages without calling any provider", async () => {
  process.env.TRACKING_MODE = "demo";
  const saved = await auth(request(app).post("/api/v2/shipments")).send({
    trackingNumber: "DEMO123",
    trackingProvider: "demo",
  });
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error("Demo must not call a provider");
    };
    for (const status of [
      "Received (demo)",
      "In transit (demo)",
      "Out for delivery (demo)",
      "Delivered (demo)",
      "Delivered (demo)",
    ]) {
      const response = await auth(
        request(app).post(`/api/v2/shipments/${saved.body.shipmentId}/sync`),
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.status, status);
      assert.equal(response.body.data.simulated, true);
      if (status === "Delivered (demo)")
        assert.equal(response.body.data.events.length, 4);
    }
  } finally {
    globalThis.fetch = realFetch;
    process.env.TRACKING_MODE = "live";
  }
});
test("tracking sync stores provider events using a mocked upstream response", async () => {
  process.env.TRACKING_MODE = "live";
  process.env.TRACKSHIP_API_KEY = "test-key";
  process.env.TRACKSHIP_APP_NAME = "test-app";
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            tracking_event_status: "delivered",
            events: [
              {
                status: "Delivered",
                datetime: "2026-10-11",
                tracking_location: { city: "Sydney" },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const saved = await auth(request(app).post("/api/v2/shipments")).send({
      trackingNumber: "ABC456",
      trackingProvider: "ups",
    });
    const sync = await auth(
      request(app).post(`/api/v2/shipments/${saved.body.shipmentId}/sync`),
    );
    assert.equal(sync.status, 200);
    assert.equal(sync.body.status, "delivered");
    assert.equal(sync.body.data.events.length, 1);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.TRACKSHIP_API_KEY;
    delete process.env.TRACKSHIP_APP_NAME;
  }
});
test("provider registration accepts TrackShip's documented ok response", async () => {
  process.env.TRACKING_MODE = "live";
  process.env.TRACKSHIP_API_KEY = "test-key";
  process.env.TRACKSHIP_APP_NAME = "test-app";
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ status: "ok", status_msg: "pending_trackship" }),
        { status: 200 },
      );
    const saved = await auth(request(app).post("/api/v2/shipments")).send({
      trackingNumber: "REG123",
      trackingProvider: "ups",
    });
    const result = await auth(
      request(app).post(`/api/v2/shipments/${saved.body.shipmentId}/register`),
    ).send({ orderId: "ORDER1", postalCode: "2000", destinationCountry: "AU" });
    assert.equal(result.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.TRACKSHIP_API_KEY;
    delete process.env.TRACKSHIP_APP_NAME;
  }
});
test("logout invalidates the token and expired sessions are rejected", async () => {
  const res = await auth(request(app).post("/api/v1/admin/logout"));
  assert.equal(res.status, 200);
  assert.equal((await auth(request(app).get("/api/v1/admin/me"))).status, 401);
  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 day' WHERE userid=$1",
    [userIds[1]],
  );
  assert.equal(
    (await auth(request(app).get("/api/v1/admin/me"), outsider)).status,
    401,
  );
});
