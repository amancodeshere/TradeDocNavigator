import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, ArrowLeft } from "lucide-react";
import {
  request,
  download,
  displayDate,
  errorMessage,
  type Despatch,
} from "../lib/api";
export default function DespatchDetails() {
  const { despatchId } = useParams();
  const [despatch, setDespatch] = useState<Despatch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    request<Despatch>(`/v2/despatches/${despatchId}`)
      .then((data) => {
        if (active) setDespatch(data);
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
  }, [despatchId]);
  const exportXML = async () => {
    try {
      await download(
        `/v2/despatches/${despatchId}/xml`,
        `despatch-${despatchId}.xml`,
      );
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <>
      <Link className="back-link" to="/despatches">
        <ArrowLeft size={16} />
        All despatches
      </Link>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <p role="status" className="loading">
          Loading despatch…
        </p>
      ) : (
        despatch && (
          <>
            <div className="page-heading">
              <div>
                <h1>Despatch advice</h1>
                <p>
                  Order {despatch.orderId} · {displayDate(despatch.issueDate)}
                </p>
              </div>
              <button onClick={() => void exportXML()}>
                <Download size={16} />
                Download XML
              </button>
            </div>
            <section className="document-sheet">
              <div className="document-parties">
                <div>
                  <h2>Supplier</h2>
                  <p>{despatch.supplierName}</p>
                </div>
                <div>
                  <h2>Deliver to</h2>
                  <p>{despatch.customerName}</p>
                  <p className="address">
                    {despatch.deliveryAddress}
                    <br />
                    {despatch.countryCode}
                  </p>
                </div>
              </div>
              <div
                className="table-wrap"
                role="region"
                aria-label="Despatch line items"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">Despatch items</caption>
                  <thead>
                    <tr>
                      <th>Item reference</th>
                      <th>Description</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despatch.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.itemId}</td>
                        <td>{item.description}</td>
                        <td>
                          {item.quantity} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint">Document ID: {despatch.despatchId}</p>
              <p className="hint">
                Status: {despatch.status}. This is a document preparation
                status, not a live carrier status.
              </p>
            </section>
          </>
        )
      )}
    </>
  );
}
