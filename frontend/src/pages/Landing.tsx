import { Link } from "react-router-dom";
import { ArrowRight, FileText, PackageCheck, Truck } from "lucide-react";
import { useAuth } from "../lib/auth";
export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="public-header">
        <Link to="/" className="brand">
          <img src="/logo2.png" alt="TradeDocs Navigator" />
        </Link>
        <Link to={user ? "/dashboard" : "/login"}>
          {user ? "Open workspace" : "Sign in"} <ArrowRight size={16} />
        </Link>
      </header>
      <main className="landing-main">
        <div className="landing-copy">
          <h1>Keep trade moving.</h1>
          <p className="lead">
            Create invoices, prepare despatch advice and keep your shipment
            records together. One workspace, from order to delivery.
          </p>
          <div className="actions">
            <Link className="button" to={user ? "/dashboard" : "/register"}>
              {user ? "Open your workspace" : "Create an account"}
              <ArrowRight size={18} />
            </Link>
            <Link className="text-link" to="/login">
              Already registered? Sign in
            </Link>
          </div>
        </div>
        <div className="document-preview" aria-label="Document workflow">
          <div className="document-step">
            <FileText size={24} />
            <div>
              <strong>Invoice</strong>
              <p>Turn an order into a clear, downloadable invoice.</p>
            </div>
          </div>
          <div className="document-step">
            <PackageCheck size={24} />
            <div>
              <strong>Despatch advice</strong>
              <p>Record what is leaving and where it is going.</p>
            </div>
          </div>
          <div className="document-step">
            <Truck size={24} />
            <div>
              <strong>Shipment tracking</strong>
              <p>Keep carrier references and shipment updates together.</p>
            </div>
          </div>
        </div>
      </main>
      <footer className="public-footer">
        TradeDocs Navigator · From order to delivery.
      </footer>
    </div>
  );
}
