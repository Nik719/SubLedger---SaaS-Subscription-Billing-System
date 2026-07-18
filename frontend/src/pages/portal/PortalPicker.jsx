import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { authApi, customersApi } from "../../api/resources";
import { auth } from "../../auth";
import Button from "../../components/Button";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/DataState";
import { FormField, TextInput } from "../../components/FormField";
import { useApi } from "../../hooks/useApi";

/** Portal entry. Customers sign in with their account email (Phase 9);
 * admins get a browse-as picker instead. */
export default function PortalPicker() {
  if (auth.customerId) {
    return <Navigate to={`/portal/${auth.customerId}`} replace />;
  }
  return auth.isAdmin ? <AdminBrowsePicker /> : <CustomerLogin />;
}

function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await authApi.login({ email: email.trim() });
      auth.save(session);
      navigate(`/portal/${session.customer_id}`, { replace: true });
    } catch (err) {
      setError(
        err.status === 401
          ? "We couldn't find an account with that email."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[380px] px-4 py-20">
      <h1 className="mb-1 text-center text-2xl font-semibold text-gray-900">
        SubLedger portal
      </h1>
      <p className="mb-8 text-center text-gray-600">
        Sign in with your account email.
      </p>

      <form
        onSubmit={submit}
        noValidate
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <FormField label="Email" htmlFor="portal-email" error={error}>
          <TextInput
            id="portal-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            placeholder="billing@acme.com"
            autoFocus
          />
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center">
        <Link to="/login" className="focusable text-indigo-600 hover:underline">
          Admin? Sign in here →
        </Link>
      </p>
    </div>
  );
}

function AdminBrowsePicker() {
  const { data: customers, loading, error, refetch } = useApi(customersApi.list);

  return (
    <div className="mx-auto max-w-[420px] px-4 py-16">
      <h1 className="mb-1 text-center text-2xl font-semibold text-gray-900">
        Browse portal as…
      </h1>
      <p className="mb-8 text-center text-gray-600">
        You're signed in as admin — choose a customer to view their portal.
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <SkeletonRows rows={3} cols={2} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : customers.length === 0 ? (
          <EmptyState message="No customer accounts exist yet." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  to={`/portal/${customer.id}`}
                  className="focusable block px-4 py-3 hover:bg-gray-50"
                >
                  <span className="block font-medium text-gray-900">
                    {customer.name}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {customer.email}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-center">
        <Link to="/" className="focusable text-indigo-600 hover:underline">
          ← Back to admin
        </Link>
      </p>
    </div>
  );
}
