import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { request, errorMessage, type Invoice } from "../lib/api";
export default function EditInvoice() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request<Invoice>(`/v2/invoice/${invoiceId}`)
      .then((data) => {
        if (active) {
          setInvoice(data);
          setAmount(String(data.amount));
          setDate(data.issueDate);
          setCurrency(data.currencyCode);
        }
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [invoiceId]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(`/v2/invoice/${invoiceId}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: Number(amount),
          issueDate: date,
          currencyCode: currency,
        }),
      });
      navigate(`/invoices/${invoiceId}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link className="back-link" to={`/invoices/${invoiceId}`}>
        Back to invoice
      </Link>
      <div className="page-heading">
        <div>
          <h1>Edit invoice #{invoiceId}</h1>
          <p>Update the document date, currency or payable amount.</p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading invoice…</p>
      ) : (
        invoice && (
          <form className="form-section" onSubmit={(event) => void save(event)}>
            <div className="form-grid">
              <label htmlFor="amount">
                Payable amount
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label htmlFor="date">
                Issue date
                <input
                  id="date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <label htmlFor="currency">
                Currency
                <input
                  id="currency"
                  required
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                />
              </label>
            </div>
            <p className="hint">
              Changing the payable amount keeps the original line items. Any
              difference is recorded as an adjustment in the XML.
            </p>
            <div className="form-actions">
              <Link
                className="button button-outline"
                to={`/invoices/${invoiceId}`}
              >
                Cancel
              </Link>
              <button disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )
      )}
    </>
  );
}
