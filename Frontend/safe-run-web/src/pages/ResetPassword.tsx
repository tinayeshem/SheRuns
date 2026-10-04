import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useAuth } from "../features/auth/AuthProvider";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/home", { replace: true });
  };

  return (
    <AuthShell title="Choose a new password">
      {loading && <p className="text-sm text-gray-500">Checking your link...</p>}

      {!loading && !session && (
        <div className="text-sm text-gray-700">
          <p className="mb-3">
            This reset link is not valid or has expired. Request a new one from
            the login page.
          </p>
          <Link to="/login" className="font-semibold text-brand-700 underline">
            Back to log in
          </Link>
        </div>
      )}

      {!loading && session && (
        <form onSubmit={submit} className="space-y-4">
          <PasswordField
            id="pw"
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordField
            id="pw2"
            label="Repeat password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Saving..." : "Save password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}