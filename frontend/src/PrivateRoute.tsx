import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
export default function PrivateRoute() {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <p className="loading" role="status">
        Checking your session…
      </p>
    );
  if (error)
    return (
      <div className="empty-state">
        <p role="alert">{error}</p>
        <button onClick={() => void refresh()}>Try again</button>
      </div>
    );
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}
