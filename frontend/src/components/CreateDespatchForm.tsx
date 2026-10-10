import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { request, errorMessage, today } from "../lib/api";
import { useAuth } from "../lib/auth";
export default function CreateDespatchForm() {
  const { user } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [supplier, setSupplier] = useState(user?.companyName || "");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("AU");
  const [items, setItems] = useState([
    { itemId: "", description: "", quantity: "1", unit: "EA" },
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
      const result = await request<{ despatchId: string }>("/v2/despatches", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          issueDate,
          supplierName: supplier,
          customerName: customer,
          deliveryAddress: address,
          countryCode: country,
          items: items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
          })),
        }),
      });
      navigate(`/despatches/${result.despatchId}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="form-section">
      <h2>Prepare despatch advice</h2>
      <p>
        Record the items leaving your business and their delivery destination.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label htmlFor="order-ref">
            Order reference
            <input
              id="order-ref"
              required
              maxLength={200}
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
            />
          </label>
          <label htmlFor="despatch-date">
            Issue date
            <input
              id="despatch-date"
              type="date"
              required
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </label>
          <label htmlFor="supplier">
            Supplier name
            <input
              id="supplier"
              required
              maxLength={200}
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            />
          </label>
          <label htmlFor="customer">
            Customer name
            <input
              id="customer"
              required
              maxLength={200}
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
            />
          </label>
          <label htmlFor="address">
            Delivery address
            <input
              id="address"
              required
              maxLength={1000}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <label htmlFor="country">
            Country code
            <input
              id="country"
              required
              pattern="[A-Za-z]{2}"
              maxLength={2}
              value={country}
              onChange={(event) => setCountry(event.target.value.toUpperCase())}
            />
            <span className="hint">Two letters, such as AU or NZ.</span>
          </label>
        </div>
        <h3>Items</h3>
        {items.map((item, index) => (
          <fieldset className="line-item" key={index}>
            <legend>Item {index + 1}</legend>
            <div className="form-grid">
              <label htmlFor={`item-${index}`}>
                Item reference
                <input
                  id={`item-${index}`}
                  required
                  maxLength={200}
                  value={item.itemId}
                  onChange={(event) =>
                    change(index, "itemId", event.target.value)
                  }
                />
              </label>
              <label htmlFor={`desc-${index}`}>
                Description
                <input
                  id={`desc-${index}`}
                  required
                  maxLength={1000}
                  value={item.description}
                  onChange={(event) =>
                    change(index, "description", event.target.value)
                  }
                />
              </label>
              <label htmlFor={`quantity-${index}`}>
                Quantity
                <input
                  id={`quantity-${index}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
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
                onClick={() => setItems(items.filter((_, i) => i !== index))}
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
              { itemId: "", description: "", quantity: "1", unit: "EA" },
            ])
          }
        >
          <Plus size={16} />
          Add item
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button disabled={busy}>
            {busy ? "Creating despatch…" : "Create despatch advice"}
          </button>
        </div>
      </form>
    </section>
  );
}
