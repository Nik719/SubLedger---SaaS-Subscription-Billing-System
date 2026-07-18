import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi } from "../api/resources";
import { auth } from "../auth";
import Button from "../components/Button";
import { FormField, TextInput } from "../components/FormField";

/** Admin sign-in (API key). */
export default function LoginPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!apiKey.trim()) {
      setError("Enter the admin API key.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await authApi.login({ api_key: apiKey.trim() });
      auth.save(session);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.status === 401 ? "That API key is not valid." : err.message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[380px] px-4 py-20">
      <h1 className="mb-1 text-center text-2xl font-semibold text-gray-900">
        SubLedger admin
      </h1>
      <p className="mb-8 text-center text-gray-600">
        Sign in with your admin API key.
      </p>

      <form
        onSubmit={submit}
        noValidate
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <FormField label="API key" htmlFor="admin-key" error={error}>
          <TextInput
            id="admin-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            error={error}
            placeholder="dev-admin-key"
            autoFocus
          />
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <Link to="/portal" className="focusable text-indigo-600 hover:underline">
          Customer? Go to the portal →
        </Link>
      </p>
    </div>
  );
}
