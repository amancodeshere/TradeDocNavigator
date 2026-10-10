import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Pencil, ArrowLeft } from "lucide-react";
import {
  request,
  download,
  money,
  displayDate,
  errorMessage,
  type Invoice,
} from "../lib/api";
export default function InvoiceDetails() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request<Invoice>(`/v2/invoice/${invoiceId}`)
      .then((data) => {
        if (active) setInvoice(data);
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [invoiceId]);
  const exportXML = async () => {
    try {
      await download(
        `/v2/invoice/${invoiceId}/xml`,
        `invoice-${invoiceId}.xml`,
      );
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <>
      <Link className="back-link" to="/invoices">
        <ArrowLeft size={16} />
        All invoices
      </Link>
      {busy ? (
        <p className="loading" role="status">
          Loading invoice…
        </p>
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {invoice && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Invoice #{invoice.invoiceId}</h1>
                  <p>Issued {displayDate(invoice.issueDate)}</p>
                </div>
                <div className="actions">
                  <Link
                    className="button button-outline"
                    to={`/invoices/${invoiceId}/edit`}
                  >
                    <Pencil size={16} />
                    Edit invoice
                  </Link>
                  <button onClick={() => void exportXML()}>
                    <Download size={16} />
                    Download XML
                  </button>
                </div>
              </div>
              <section className="document-sheet">
                <div className="document-parties">
                  <div>
                    <h2>From</h2>
                    <p>{invoice.partyNameSeller}</p>
                  </div>
                  <div>
                    <h2>Bill to</h2>
                    <p>{invoice.partyNameBuyer}</p>
                  </div>
                </div>
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Invoice line items"
                  tabIndex={0}
                >
                  <table>
                    <caption className="sr-only">Invoice line items</caption>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Unit price</th>
                        <th>Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items?.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <strong>{item.name}</strong>
                            <p className="hint">{item.description}</p>
                          </td>
                          <td>
                            {item.quantity} {item.unit}
                          </td>
                          <td>{money(item.price, invoice.currencyCode)}</td>
                          <td className="amount">
                            {money(
                              item.price * item.quantity,
                              invoice.currencyCode,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="document-total">
                  <span>Payable amount</span>
                  <strong>{money(invoice.amount, invoice.currencyCode)}</strong>
                </div>
                <p className="hint">Order reference: {invoice.salesOrderId}</p>
                {invoice.items &&
                  Math.abs(
                    invoice.amount -
                      invoice.items.reduce(
                        (sum, item) => sum + item.price * item.quantity,
                        0,
                      ),
                  ) > 0.005 && (
                    <p className="hint">
                      The payable amount includes an order total adjustment,
                      shown in the exported XML.
                    </p>
                  )}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
