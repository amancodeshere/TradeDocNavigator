import { randomUUID } from "node:crypto";
import { db, transaction } from "../connect.js";
import { assert, text, HttpError } from "./errors.js";

export const trackingConfigured = () =>
  Boolean(
    process.env.TRACKSHIP_API_KEY &&
    (process.env.TRACKSHIP_APP_NAME || process.env.APP_NAME),
  );
export const trackingMode = () =>
  process.env.TRACKING_MODE || (trackingConfigured() ? "live" : "demo");
const model = (row) => ({
  shipmentId: row.id,
  trackingNumber: row.tracking_number,
  trackingProvider: row.tracking_provider,
  status: row.status,
  syncedAt: row.synced_at,
  data: row.data,
});
export async function listShipments(user) {
  const { rows } = await db.query(
    "SELECT * FROM tracked_shipments WHERE userid=$1 ORDER BY created_at DESC LIMIT 500",
    [user.userId],
  );
  return {
    shipments: rows.map(model),
    liveTrackingAvailable: trackingMode() === "live" && trackingConfigured(),
    trackingMode: trackingMode(),
  };
}
export async function addShipment(user, body) {
  const number = text(body.trackingNumber, "Tracking number", 100);
  const provider = text(
    body.trackingProvider,
    "Carrier slug",
    100,
  ).toLowerCase();
  assert(
    /^[a-z0-9_-]+$/.test(provider),
    "Use the carrier slug, such as australia-post or ups.",
  );
  const { rows } = await db.query(
    `INSERT INTO tracked_shipments (id,userid,tracking_number,tracking_provider) VALUES ($1,$2,$3,$4)
    ON CONFLICT (userid,tracking_number,tracking_provider) DO UPDATE SET tracking_number=EXCLUDED.tracking_number RETURNING *`,
    [randomUUID(), user.userId, number, provider],
  );
  return model(rows[0]);
}
export async function trackshipRequest(action, body) {
  assert(
    trackingConfigured(),
    "Live tracking is not configured. Add TRACKSHIP_API_KEY and TRACKSHIP_APP_NAME to the server.",
    503,
  );
  let response;
  try {
    response = await fetch(`https://api.trackship.com/v1/shipment/${action}/`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        "trackship-api-key": process.env.TRACKSHIP_API_KEY,
        "app-name": process.env.TRACKSHIP_APP_NAME || process.env.APP_NAME,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HttpError(
      502,
      "The carrier tracking service did not respond. Please try again.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new HttpError(
      502,
      "The tracking service returned an unreadable response.",
    );
  }
  assert(
    response.ok &&
      (result.status === "success" ||
        (action === "create" && result.status === "ok")),
    result.message || "The tracking service could not find this shipment.",
    502,
  );
  return result.data || {};
}
async function simulateShipment(user, id) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM tracked_shipments WHERE id=$1 AND userid=$2 FOR UPDATE",
      [id, user.userId],
    );
    assert(rows.length, "Shipment not found.", 404);
    const previous = rows[0].data.simulated ? rows[0].data : {};
    const steps = [
      {
        status: "Received (demo)",
        description: "The simulated carrier has received the shipment.",
        city: "Origin facility",
      },
      {
        status: "In transit (demo)",
        description:
          "The simulated shipment is moving through the carrier network.",
        city: "Transit hub",
      },
      {
        status: "Out for delivery (demo)",
        description: "The simulated shipment is with a delivery driver.",
        city: "Destination delivery area",
      },
      {
        status: "Delivered (demo)",
        description:
          "The simulated shipment has been delivered. No real parcel was tracked.",
        city: "Demo delivery location",
      },
    ];
    const step = Math.min(
      Number(previous.demoStep ?? -1) + 1,
      steps.length - 1,
    );
    const current = steps[step];
    const events = [...(previous.events || [])];
    if (previous.demoStep !== step)
      events.push({
        status: current.status,
        description: current.description,
        datetime: new Date().toISOString(),
        tracking_location: { city: current.city },
      });
    const data = { simulated: true, demoStep: step, events };
    const { rows: updated } = await client.query(
      "UPDATE tracked_shipments SET status=$1,data=$2,synced_at=now() WHERE id=$3 AND userid=$4 RETURNING *",
      [current.status, JSON.stringify(data), id, user.userId],
    );
    return model(updated[0]);
  });
}
export async function syncShipment(user, id) {
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    "Shipment not found.",
    404,
  );
  const { rows } = await db.query(
    "SELECT * FROM tracked_shipments WHERE id=$1 AND userid=$2",
    [id, user.userId],
  );
  assert(rows.length, "Shipment not found.", 404);
  if (trackingMode() === "demo") return simulateShipment(user, id);
  assert(trackingMode() === "live", "Carrier updates are disabled.", 503);
  const shipment = rows[0];
  const data = await trackshipRequest("get", {
    tracking_number: shipment.tracking_number,
    tracking_provider: shipment.tracking_provider,
  });
  const status =
    typeof data.tracking_event_status === "string"
      ? data.tracking_event_status
      : "Status unavailable";
  const { rows: updated } = await db.query(
    "UPDATE tracked_shipments SET status=$1,data=$2,synced_at=now() WHERE id=$3 AND userid=$4 RETURNING *",
    [status, JSON.stringify(data), id, user.userId],
  );
  return model(updated[0]);
}
export async function registerWithCarrier(user, id, body) {
  assert(
    trackingMode() === "live",
    "Live carrier registration is disabled in demo mode.",
    503,
  );
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    "Shipment not found.",
    404,
  );
  const { rows } = await db.query(
    "SELECT * FROM tracked_shipments WHERE id=$1 AND userid=$2",
    [id, user.userId],
  );
  assert(rows.length, "Shipment not found.", 404);
  await trackshipRequest("create", {
    tracking_number: rows[0].tracking_number,
    tracking_provider: rows[0].tracking_provider,
    order_id: text(body.orderId, "Order reference"),
    postal_code: text(body.postalCode, "Postal code", 30),
    destination_country: text(
      body.destinationCountry,
      "Destination country",
      2,
    ).toUpperCase(),
  });
  return {
    message:
      "Shipment registered with TrackShip. Refresh to retrieve its status.",
  };
}
