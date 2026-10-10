import { useEffect, useState, type FormEvent } from "react";
import { request, errorMessage, type Shipment } from "../lib/api";
export default function Tracking() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState("demo");
  const [number, setNumber] = useState("");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [orderId, setOrderId] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("AU");
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await request<{
        shipments: Shipment[];
        liveTrackingAvailable: boolean;
        trackingMode: string;
      }>("/v2/shipments");
      setShipments(data.shipments);
      setLive(data.liveTrackingAvailable);
      setMode(data.trackingMode);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/v2/shipments", {
        method: "POST",
        body: JSON.stringify({
          trackingNumber: number,
          trackingProvider: provider,
        }),
      });
      setNumber("");
      setProvider("");
      await load();
      setMessage("Tracking reference saved.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const sync = async (item: Shipment) => {
    setSyncing(item.shipmentId);
    setError("");
    try {
      const updated = await request<Shipment>(
        `/v2/shipments/${item.shipmentId}/sync`,
        { method: "POST" },
      );
      setShipments(
        shipments.map((s) =>
          s.shipmentId === updated.shipmentId ? updated : s,
        ),
      );
      if (selected?.shipmentId === updated.shipmentId) setSelected(updated);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSyncing(null);
    }
  };
  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setRegistering(true);
    setError("");
    try {
      const data = await request<{ message: string }>(
        `/v2/shipments/${selected.shipmentId}/register`,
        {
          method: "POST",
          body: JSON.stringify({
            orderId,
            postalCode,
            destinationCountry: country,
          }),
        },
      );
      setMessage(data.message);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setRegistering(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Shipment tracking</h1>
          <p>Your carrier references and latest available updates.</p>
        </div>
        <button
          className="button-outline"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh list
        </button>
      </div>
      {!busy && mode === "demo" && (
        <p className="notice">
          Demo tracking is enabled. Advance a saved shipment through simulated
          delivery events. These updates do not track a real parcel and do not
          use a paid service.
        </p>
      )}
      {!busy && mode !== "demo" && !live && (
        <p className="notice">
          Live carrier updates are not enabled yet. You can save tracking
          references here and return when the service is connected.
        </p>
      )}
      <form className="tracking-form" onSubmit={(event) => void save(event)}>
        <label htmlFor="tracking-number">
          Tracking number
          <input
            id="tracking-number"
            required
            maxLength={100}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </label>
        <label htmlFor="carrier">
          Carrier
          <input
            id="carrier"
            required
            maxLength={100}
            pattern="[A-Za-z0-9_-]+"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            placeholder="e.g. ups"
          />
          <span className="hint">
            {mode === "demo"
              ? "Any short carrier name, such as ups."
              : "Use a supported carrier identifier, such as ups."}
          </span>
        </label>
        <button disabled={saving}>
          {saving ? "Saving…" : "Save tracking reference"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {busy ? (
        <p className="loading" role="status">
          Loading shipments…
        </p>
      ) : shipments.length === 0 ? (
        <div className="empty-state">
          <h2>No shipments saved yet</h2>
          <p>
            Add a tracking number and carrier above to keep its reference in
            your workspace.
          </p>
        </div>
      ) : (
        <div
          className="table-wrap"
          role="region"
          aria-label="Shipments"
          tabIndex={0}
        >
          <table>
            <caption className="sr-only">Saved shipments</caption>
            <thead>
              <tr>
                <th>Tracking number</th>
                <th>Carrier</th>
                <th>Status</th>
                <th>Last checked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((item) => (
                <tr key={item.shipmentId}>
                  <td>{item.trackingNumber}</td>
                  <td>{item.trackingProvider}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.syncedAt
                      ? new Date(item.syncedAt).toLocaleString("en-AU")
                      : "Not checked"}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="button-outline"
                        onClick={() => {
                          setSelected(item);
                          setMessage("");
                        }}
                      >
                        Details
                      </button>
                      <button
                        disabled={
                          (mode !== "demo" && !live) || syncing !== null
                        }
                        onClick={() => void sync(item)}
                      >
                        {syncing === item.shipmentId
                          ? "Checking…"
                          : mode === "demo"
                            ? "Advance demo"
                            : "Check status"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <section className="shipment-details">
          <div className="page-heading">
            <div>
              <h2>Shipment {selected.trackingNumber}</h2>
              <p>
                {selected.trackingProvider} · {selected.status}
              </p>
            </div>
            <button
              className="button-outline"
              onClick={() => setSelected(null)}
            >
              Close details
            </button>
          </div>
          {selected.data.tracking_est_delivery_date && (
            <p>
              Estimated delivery: {selected.data.tracking_est_delivery_date}
            </p>
          )}
          {selected.data.simulated && (
            <p className="notice">
              Simulated events · This is a demonstration, not a real carrier
              report.
            </p>
          )}
          <h3>Event history</h3>
          {selected.data.events?.length ? (
            <ol className="event-list">
              {selected.data.events.map((event, index) => (
                <li key={index}>
                  <strong>
                    {event.status || event.message || "Shipment update"}
                  </strong>
                  <p>{event.description}</p>
                  <p className="hint">
                    {event.datetime}{" "}
                    {[
                      event.tracking_location?.city,
                      event.tracking_location?.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p>No carrier events have been retrieved yet.</p>
          )}
          {live && (
            <form onSubmit={(event) => void register(event)}>
              <h3>Register with TrackShip</h3>
              <p className="hint">
                If this reference is not already registered with TrackShip,
                submit the delivery details first.
              </p>
              <div className="form-grid">
                <label htmlFor="tracking-order">
                  Order reference
                  <input
                    id="tracking-order"
                    required
                    maxLength={200}
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                  />
                </label>
                <label htmlFor="postal">
                  Destination postal code
                  <input
                    id="postal"
                    required
                    maxLength={30}
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                  />
                </label>
                <label htmlFor="tracking-country">
                  Destination country
                  <input
                    id="tracking-country"
                    required
                    pattern="[A-Za-z]{2}"
                    maxLength={2}
                    value={country}
                    onChange={(event) =>
                      setCountry(event.target.value.toUpperCase())
                    }
                  />
                </label>
              </div>
              <button disabled={registering}>
                {registering ? "Registering…" : "Register shipment"}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
