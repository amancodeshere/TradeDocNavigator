import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiError, request, type User } from "./api";

interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setUser((await request<{ user: User }>("/v1/admin/me")).user);
    } catch (error) {
      setUser(null);
      if (!(error instanceof ApiError && error.status === 401))
        setError(
          "Unable to check your session. Check your connection and retry.",
        );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    localStorage.removeItem("token");
    void refresh();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  const signOut = async () => {
    await request("/v1/admin/logout", { method: "POST" });
    setUser(null);
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, signIn: setUser, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
