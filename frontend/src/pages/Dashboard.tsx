import { Link } from "react-router-dom";
import { ArrowUpRight, FileText, PackageCheck, Truck } from "lucide-react";
import { useAuth } from "../lib/auth";
export default function Dashboard() {
  const { user } = useAuth();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your trade workspace</h1>
          <p>Welcome, {user?.companyName}. Keep the next step moving.</p>
        </div>
      </div>
      <div className="workspace-links">
        <Link to="/invoices">
          <FileText />
          <div>
            <h2>Invoices</h2>
            <p>
              Create from order XML or item details. View, edit and download
              your documents.
            </p>
          </div>
          <ArrowUpRight />
        </Link>
        <Link to="/despatches">
          <PackageCheck />
          <div>
            <h2>Despatch advice</h2>
            <p>
              Prepare item quantities and delivery details, then download UBL
              XML.
            </p>
          </div>
          <ArrowUpRight />
        </Link>
        <Link to="/orders">
          <Truck />
          <div>
            <h2>Shipment tracking</h2>
            <p>
              Save tracking references and retrieve carrier updates when live
              tracking is enabled.
            </p>
          </div>
          <ArrowUpRight />
        </Link>
      </div>
      <aside className="workspace-note">
        <h2>Start with an invoice</h2>
        <p>
          Paste an existing UBL order or enter your buyer and line items. Your
          documents are saved to this account and available when you sign in
          again.
        </p>
        <Link className="text-link" to="/invoices">
          Open invoice hub <ArrowUpRight size={16} />
        </Link>
      </aside>
    </>
  );
}
