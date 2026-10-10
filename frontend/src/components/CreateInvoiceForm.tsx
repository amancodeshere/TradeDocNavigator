import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { request, errorMessage, today } from "../lib/api";
export default function CreateInvoiceForm() {
  const [mode, setMode] = useState("form");
  const [buyer, setBuyer] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [currency, setCurrency] = useState("AUD");
  const [xml, setXml] = useState("");
  const [items, setItems] = useState([
    { name: "", description: "", price: "", quantity: "1", unit: "EA" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const change = (index: number, field: string, value: string) =>
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request<{ invoiceId: number }>(
        "/v2/invoice/create",
        {
          method: "POST",
          ...(mode === "xml"
            ? { headers: { "Content-Type": "application/xml" }, body: xml }
            : {
                body: JSON.stringify({
                  IssueDate: issueDate,
                  PartyName: buyer,
                  CurrencyCode: currency,
                  Items: items.map((item) => ({
                    ItemName: item.name,
                    ItemDescription: item.description || item.name,
                    ItemPrice: Number(item.price),
                    ItemQuantity: Number(item.quantity),
                    ItemUnitCode: item.unit,
                  })),
                }),
              }),
        },
      );
      navigate(`/invoices/${result.invoiceId}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="form-section">
      <h2>Create invoice</h2>
      <p>Enter line items or import a UBL order.</p>
      <div className="segmented" aria-label="Invoice input method">
        <button
          type="button"
          aria-pressed={mode === "form"}
          onClick={() => setMode("form")}
        >
          Enter details
        </button>
        <button
          type="button"
          aria-pressed={mode === "xml"}
          onClick={() => setMode("xml")}
        >
          Import order XML
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        {mode === "xml" ? (
          <label htmlFor="order-xml">
            Order XML
            <textarea
              id="order-xml"
              required
              maxLength={500000}
              value={xml}
              onChange={(event) => setXml(event.target.value)}
              placeholder="Paste your UBL Order XML"
              spellCheck={false}
            />
          </label>
        ) : (
          <>
            <div className="form-grid">
              <label htmlFor="buyer">
                Buyer name
                <input
                  id="buyer"
                  required
                  maxLength={200}
                  value={buyer}
                  onChange={(event) => setBuyer(event.target.value)}
                />
              </label>
              <label htmlFor="issue-date">
                Issue date
                <input
                  id="issue-date"
                  type="date"
                  required
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
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
            <h3>Line items</h3>
            {items.map((item, index) => (
              <fieldset className="line-item" key={index}>
                <legend>Item {index + 1}</legend>
                <div className="form-grid">
                  <label htmlFor={`name-${index}`}>
                    Item name
                    <input
                      id={`name-${index}`}
                      required
                      maxLength={200}
                      value={item.name}
                      onChange={(event) =>
                        change(index, "name", event.target.value)
                      }
                    />
                  </label>
                  <label htmlFor={`description-${index}`}>
                    Description
                    <input
                      id={`description-${index}`}
                      maxLength={1000}
                      value={item.description}
                      onChange={(event) =>
                        change(index, "description", event.target.value)
                      }
                    />
                  </label>
                  <label htmlFor={`price-${index}`}>
                    Unit price
                    <input
                      id={`price-${index}`}
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) =>
                        change(index, "price", event.target.value)
                      }
                    />
                  </label>
                  <label htmlFor={`qty-${index}`}>
                    Quantity
                    <input
                      id={`qty-${index}`}
                      type="number"
                      required
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) =>
                        change(index, "quantity", event.target.value)
                      }
                    />
                  </label>
                  <label htmlFor={`unit-${index}`}>
                    Unit
                    <select
                      id={`unit-${index}`}
                      value={item.unit}
                      onChange={(event) =>
                        change(index, "unit", event.target.value)
                      }
                    >
                      <option value="EA">Each</option>
                      <option value="KGM">Kilograms</option>
                      <option value="LTR">Litres</option>
                    </select>
                  </label>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="button-outline"
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={16} />
                    Remove item {index + 1}
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              className="button-outline"
              disabled={items.length >= 100}
              onClick={() =>
                setItems([
                  ...items,
                  {
                    name: "",
                    description: "",
                    price: "",
                    quantity: "1",
                    unit: "EA",
                  },
                ])
              }
            >
              <Plus size={16} />
              Add item
            </button>
            <p className="total-preview">
              Total: {currency}{" "}
              {items
                .reduce(
                  (sum, item) =>
                    sum + Number(item.price) * Number(item.quantity),
                  0,
                )
                .toFixed(2)}
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" disabled={busy}>
            {busy ? "Creating invoice…" : "Create invoice"}
          </button>
        </div>
      </form>
    </section>
  );
}
