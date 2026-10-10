import { Routes, Route, Link } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Despatches from "./pages/Despatches";
import Invoices from "./pages/Invoices";
import InvoiceDetails from "./pages/InvoiceDetailsPage";
import EditInvoice from "./pages/EditInvoicePage";
import DespatchDetails from "./pages/DespatchDetailsPage";
import PrivateRoute from "./PrivateRoute";
import AppLayout from "./components/AppLayout";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:invoiceId" element={<InvoiceDetails />} />
          <Route path="/invoices/:invoiceId/edit" element={<EditInvoice />} />
          <Route path="/despatches" element={<Despatches />} />
          <Route path="/despatches/:despatchId" element={<DespatchDetails />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <main className="page empty-state">
            <h1>Page not found</h1>
            <p>This address does not match a page.</p>
            <Link className="button" to="/dashboard">
              Go to overview
            </Link>
          </main>
        }
      />
    </Routes>
  );
}
