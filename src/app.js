import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./connect.js";
import { asyncRoute, HttpError } from "./services/errors.js";
import { register, login, authenticate, logout } from "./services/auth.js";
import {
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
} from "./services/invoices.js";
import { invoiceXML, despatchXML, validateInvoiceXML } from "./services/xml.js";
import {
  createDespatch,
  listDespatches,
  getDespatch,
  deleteDespatch,
  restoreDespatch,
} from "./services/despatches.js";
import {
  addShipment,
  listShipments,
  syncShipment,
  registerWithCarrier,
} from "./services/tracking.js";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "upgrade-insecure-requests":
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin")) {
    try {
      if (new URL(req.get("origin")).host !== req.get("host"))
        throw new Error("origin");
    } catch {
      return res
        .status(403)
        .json({ error: "This request must come from the application." });
    }
  }
  next();
});
app.use(express.json({ limit: "512kb" }));
app.use(
  express.text({ type: ["application/xml", "text/xml"], limit: "512kb" }),
);
app.get(
  "/api/health",
  asyncRoute(async (req, res) => {
    await db.query("SELECT 1");
    res.json({
      status: "success",
      database: "connected",
      uptime: Math.floor(process.uptime()),
    });
  }),
);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many sign-in attempts. Please try again in 15 minutes.",
  },
});
app.post("/api/v1/admin/register", authLimiter, register);
app.post("/api/v1/admin/login", authLimiter, login);
app.use("/api", authenticate);
app.get("/api/v1/admin/me", (req, res) => res.json({ user: req.user }));
app.post("/api/v1/admin/logout", logout);
app.get(
  ["/api/v2/invoice/list", "/api/v2/invoices/list", "/api/v1/invoices/list"],
  asyncRoute(async (req, res) =>
    res.json(await listInvoices(req.user, req.query.partyNameBuyer)),
  ),
);
app.post(
  ["/api/v2/invoice/create", "/api/v1/invoice/create"],
  asyncRoute(async (req, res) => {
    if (
      !req.is("application/json") &&
      !req.is("application/xml") &&
      !req.is("text/xml")
    )
      throw new HttpError(415, "Submit JSON or an XML order.");
    res
      .status(201)
      .json(
        await createInvoice(req.user, req.body, !req.is("application/json")),
      );
  }),
);
const validateLimiter = rateLimit({
  windowMs: 60000,
  limit: 10,
  message: {
    error: "Please wait a minute before validating more XML documents.",
  },
});
app.post(
  "/api/v1/invoice/validate",
  validateLimiter,
  asyncRoute(async (req, res) => {
    const result = await validateInvoiceXML(req.body.invoice);
    res.status(result.unavailable ? 503 : 200).json(result);
  }),
);
app.get(
  ["/api/v2/invoice/:id/xml", "/api/v1/invoice/:id/xml"],
  asyncRoute(async (req, res) => {
    const invoice = await getInvoice(req.user, req.params.id);
    res
      .type("application/xml")
      .attachment(`invoice-${invoice.invoiceId}.xml`)
      .send(invoiceXML(invoice));
  }),
);
app.get(
  ["/api/v2/invoice/:id", "/api/v1/invoice/:id"],
  asyncRoute(async (req, res) =>
    res.json(await getInvoice(req.user, req.params.id)),
  ),
);
app.put(
  ["/api/v2/invoice/:id", "/api/v1/invoice/update/:id"],
  asyncRoute(async (req, res) =>
    res.json(await updateInvoice(req.user, req.params.id, req.body)),
  ),
);
app.get(
  "/api/v2/despatches",
  asyncRoute(async (req, res) => res.json(await listDespatches(req.user))),
);
app.post(
  "/api/v2/despatches",
  asyncRoute(async (req, res) =>
    res.status(201).json(await createDespatch(req.user, req.body)),
  ),
);
app.get(
  "/api/v2/despatches/:id/xml",
  asyncRoute(async (req, res) =>
    res
      .type("application/xml")
      .attachment("despatch.xml")
      .send(despatchXML(await getDespatch(req.user, req.params.id))),
  ),
);
app.get(
  "/api/v2/despatches/:id",
  asyncRoute(async (req, res) =>
    res.json(await getDespatch(req.user, req.params.id)),
  ),
);
app.delete(
  "/api/v2/despatches/:id",
  asyncRoute(async (req, res) =>
    res.json(await deleteDespatch(req.user, req.params.id)),
  ),
);
app.post(
  "/api/v2/despatches/:id/restore",
  asyncRoute(async (req, res) =>
    res.json(await restoreDespatch(req.user, req.params.id)),
  ),
);
app.get(
  "/api/v2/shipments",
  asyncRoute(async (req, res) => res.json(await listShipments(req.user))),
);
app.post(
  "/api/v2/shipments",
  asyncRoute(async (req, res) =>
    res.status(201).json(await addShipment(req.user, req.body)),
  ),
);
app.post(
  "/api/v2/shipments/:id/sync",
  asyncRoute(async (req, res) =>
    res.json(await syncShipment(req.user, req.params.id)),
  ),
);
app.post(
  "/api/v2/shipments/:id/register",
  asyncRoute(async (req, res) =>
    res.json(await registerWithCarrier(req.user, req.params.id, req.body)),
  ),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
const dist = fileURLToPath(new URL("../frontend/dist/", import.meta.url));
if (existsSync(`${dist}/index.html`)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get("*", (req, res) =>
    res.set("Cache-Control", "no-cache").sendFile(`${dist}/index.html`),
  );
} else {
  app.get("/", (req, res) =>
    res
      .type("text")
      .send(
        "API is running. Start Vite for development, or build the frontend to serve the application here.",
      ),
  );
}
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error("Request failed:", error.message);
  res
    .status(status)
    .json({
      error:
        status >= 500 && !(error instanceof HttpError)
          ? "The service could not complete this request. Please try again."
          : error.message,
    });
});
