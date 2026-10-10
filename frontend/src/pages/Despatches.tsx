import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Download, Trash2 } from "lucide-react";
import {
  request,
  download,
  displayDate,
  errorMessage,
  type Despatch,
} from "../lib/api";
import CreateDespatchForm from "../components/CreateDespatchForm";
export default function Despatches() {
  const [tab, setTab] = useState("list");
  const [despatches, setDespatches] = useState<Despatch[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setDespatches(
        (await request<{ despatches: Despatch[] }>("/v2/despatches"))
          .despatches,
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const remove = async () => {
    if (!pending) return;
    setActionBusy(true);
    try {
      await request(`/v2/despatches/${pending}`, { method: "DELETE" });
      setRemoved(pending);
      setPending(null);
      await load();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  };
  const undo = async () => {
    setActionBusy(true);
    try {
      await request(`/v2/despatches/${removed}/restore`, { method: "POST" });
      setRemoved(null);
      await load();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setActionBusy(false);
    }
  };
  const exportXML = async (id: string) => {
    try {
      await download(`/v2/despatches/${id}/xml`, `despatch-${id}.xml`);
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  const filtered = despatches.filter((item) =>
    [item.orderId, item.customerName, item.supplierName, item.despatchId].some(
      (value) => value.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Despatch advice</h1>
          <p>
            Prepare delivery details and keep a record of the items leaving.
          </p>
        </div>
      </div>
      <div className="tabs" aria-label="Despatch sections">
        <button aria-pressed={tab === "list"} onClick={() => setTab("list")}>
          Your despatches
        </button>
        <button
          aria-pressed={tab === "create"}
          onClick={() => setTab("create")}
        >
          Create despatch
        </button>
      </div>
      {tab === "create" ? (
        <CreateDespatchForm />
      ) : (
        <section>
          <div className="filter-form">
            <label htmlFor="despatch-search">
              Search despatches
              <input
                id="despatch-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order, customer or supplier"
              />
            </label>
            <button
              className="button-outline"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {removed && (
            <div className="notice" role="status">
              <span>Despatch advice removed.</span>
              <button
                className="button-outline"
                disabled={actionBusy}
                onClick={() => void undo()}
              >
                Undo
              </button>
            </div>
          )}
          {pending && (
            <div className="notice" role="alert">
              <p>
                Remove this despatch advice from your list? You can undo this
                action.
              </p>
              <div className="actions">
                <button
                  className="button-danger"
                  disabled={actionBusy}
                  onClick={() => void remove()}
                >
                  Confirm removal
                </button>
                <button
                  className="button-outline"
                  disabled={actionBusy}
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {busy ? (
            <p role="status" className="loading">
              Loading despatches…
            </p>
          ) : !error && filtered.length === 0 ? (
            <div className="empty-state">
              <h2>
                {search
                  ? "No matching despatches"
                  : "Prepare your first despatch"}
              </h2>
              <p>
                {search
                  ? "Try another order, customer or supplier."
                  : "Add the order reference, destination and items to create a despatch advice document."}
              </p>
              <button onClick={() => setTab("create")}>Create despatch</button>
            </div>
          ) : (
            !error && (
              <div
                className="table-wrap"
                role="region"
                aria-label="Despatches"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Your despatch advice documents
                  </caption>
                  <thead>
                    <tr>
                      <th>Order reference</th>
                      <th>Issue date</th>
                      <th>Customer</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.despatchId}>
                        <td>
                          <Link to={`/despatches/${item.despatchId}`}>
                            {item.orderId}
                          </Link>
                        </td>
                        <td>{displayDate(item.issueDate)}</td>
                        <td>{item.customerName}</td>
                        <td>{item.supplierName}</td>
                        <td>
                          <span className="status-badge">{item.status}</span>
                        </td>
                        <td>
                          <div className="actions">
                            <Link
                              className="icon-button"
                              to={`/despatches/${item.despatchId}`}
                              aria-label={`View despatch for ${item.orderId}`}
                            >
                              <Eye size={18} />
                            </Link>
                            <button
                              className="icon-button"
                              aria-label={`Download despatch for ${item.orderId}`}
                              onClick={() => void exportXML(item.despatchId)}
                            >
                              <Download size={18} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Remove despatch for ${item.orderId}`}
                              onClick={() => setPending(item.despatchId)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      )}
    </>
  );
}
