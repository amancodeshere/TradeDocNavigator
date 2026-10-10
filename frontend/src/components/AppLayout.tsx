import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
export default function AppLayout() {
  const { user, signOut } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <NavLink to="/dashboard" className="brand">
          <img src="/logo2.png" alt="TradeDocs Navigator" />
        </NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/invoices">Invoices</NavLink>
          <NavLink to="/despatches">Despatches</NavLink>
          <NavLink to="/orders">Tracking</NavLink>
        </nav>
        <div className="account">
          <span>{user?.companyName}</span>
          <button
            className="button-outline"
            onClick={() => void logout()}
            disabled={busy}
          >
            <LogOut size={16} />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      {error && (
        <p className="error page" role="alert">
          {error}
        </p>
      )}
      <main id="main-content" className="page">
        <Outlet />
      </main>
      <footer className="app-footer">
        TradeDocs Navigator · Your documents, from order to delivery.
      </footer>
    </>
  );
}
