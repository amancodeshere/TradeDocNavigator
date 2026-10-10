import { useState, type FormEvent } from "react";
import { request, errorMessage } from "../lib/api";
export default function ValidateXMLForm() {
  const [xml, setXml] = useState("");
  const [result, setResult] = useState<{
    validated: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await request("/v1/invoice/validate", {
          method: "POST",
          body: JSON.stringify({ invoice: xml }),
        }),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="form-section">
      <h2>Validate invoice XML</h2>
      <p>
        Check an invoice against the UBL 2.1 XML schema. This does not certify
        Peppol or tax compliance.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="validate-xml">
          Invoice XML
          <textarea
            id="validate-xml"
            required
            maxLength={500000}
            spellCheck={false}
            value={xml}
            onChange={(event) => setXml(event.target.value)}
            placeholder="Paste your Invoice XML"
          />
        </label>
        <button disabled={busy}>{busy ? "Validating…" : "Validate XML"}</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className={result.validated ? "success" : "error"}>
          {result.message}
        </p>
      )}
    </section>
  );
}
