import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, Pencil } from "lucide-react";
import {
  request,
  download,
  money,
  displayDate,
  errorMessage,
  type Invoice,
} from "../lib/api";
import CreateInvoiceForm from "../components/CreateInvoiceForm";
import ValidateXMLForm from "../components/ValidateXMLForm";
export default function Invoices() {
  const [tab, setTab] = useState("list");
  const [buyer, setBuyer] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = async (filter = "") => {
    setBusy(true);
    setError("");
    try {
      setInvoices(
        (
          await request<{ invoices: Invoice[] }>(
            `/v2/invoice/list?partyNameBuyer=${encodeURIComponent(filter)}`,
          )
        ).invoices,
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
  const filter = (event: FormEvent) => {
    event.preventDefault();
    void load(buyer);
  };
  const downloadXML = async (id: number) => {
    try {
      await download(`/v2/invoice/${id}/xml`, `invoice-${id}.xml`);
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Invoice hub</h1>
          <p>From order details to a document ready to share.</p>
        </div>
      </div>
      <div className="tabs" aria-label="Invoice sections">
        <button aria-pressed={tab === "list"} onClick={() => setTab("list")}>
          Your invoices
        </button>
        <button
          aria-pressed={tab === "create"}
          onClick={() => setTab("create")}
        >
          Create invoice
        </button>
        <button
          aria-pressed={tab === "validate"}
          onClick={() => setTab("validate")}
        >
          Validate XML
        </button>
      </div>
      {tab === "create" && <CreateInvoiceForm />}
      {tab === "validate" && <ValidateXMLForm />}
      {tab === "list" && (
        <section>
          <form className="filter-form" onSubmit={filter}>
            <label htmlFor="buyer-filter">
              Buyer name
              <input
                id="buyer-filter"
                maxLength={200}
                placeholder="Search your invoices by buyer"
                value={buyer}
                onChange={(event) => setBuyer(event.target.value)}
              />
            </label>
            <button disabled={busy}>Search</button>
            {buyer && (
              <button
                type="button"
                className="button-outline"
                onClick={() => {
                  setBuyer("");
                  void load();
                }}
              >
                Clear
              </button>
            )}
          </form>
          {error && (
            <div className="error" role="alert">
              <p>{error}</p>
              <button
                className="button-outline"
                onClick={() => void load(buyer)}
              >
                Try again
              </button>
            </div>
          )}
          {busy ? (
            <p className="loading" role="status">
              Loading invoices…
            </p>
          ) : !error && invoices.length === 0 ? (
            <div className="empty-state">
              <h2>
                {buyer
                  ? "No matching invoices"
                  : "Your first invoice starts here"}
              </h2>
              <p>
                {buyer
                  ? "Try another buyer name or clear the search."
                  : "Create an invoice from line items or paste a UBL order."}
              </p>
              <button onClick={() => setTab("create")}>Create invoice</button>
            </div>
          ) : (
            !error && (
              <div
                className="table-wrap"
                role="region"
                aria-label="Invoices"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">Your invoices</caption>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Issue date</th>
                      <th>Buyer</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.invoiceId}>
                        <td>
                          <Link to={`/invoices/${invoice.invoiceId}`}>
                            #{invoice.invoiceId}
                          </Link>
                        </td>
                        <td>{displayDate(invoice.issueDate)}</td>
                        <td>{invoice.partyNameBuyer}</td>
                        <td className="amount">
                          {money(invoice.amount, invoice.currencyCode)}
                        </td>
                        <td>
                          <div className="actions">
                            <Link
                              className="icon-button"
                              aria-label={`View invoice ${invoice.invoiceId}`}
                              to={`/invoices/${invoice.invoiceId}`}
                            >
                              <Eye size={18} />
                            </Link>
                            <Link
                              className="icon-button"
                              aria-label={`Edit invoice ${invoice.invoiceId}`}
                              to={`/invoices/${invoice.invoiceId}/edit`}
                            >
                              <Pencil size={18} />
                            </Link>
                            <button
                              className="icon-button"
                              aria-label={`Download invoice ${invoice.invoiceId} XML`}
                              onClick={() =>
                                void downloadXML(invoice.invoiceId)
                              }
                            >
                              <Download size={18} />
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
