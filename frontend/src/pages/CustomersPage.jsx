import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { customersApi } from "../api/resources";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { EmptyState, ErrorState, SkeletonRows } from "../components/DataState";
import { FormField, TextInput } from "../components/FormField";
import Modal from "../components/Modal";
import { useApi } from "../hooks/useApi";

/** A4 Customers list: search by name/email, create with 409 inline. */
export default function CustomersPage() {
  const { data: customers, loading, error, refetch } = useApi(customersApi.list);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query)
    );
  }, [customers, search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <Button onClick={() => setCreating(true)}>Create customer</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <TextInput
          id="customer-search"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search customers"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState
              message="No customers yet. Add your first customer."
              actionLabel="Create customer"
              onAction={() => setCreating(true)}
            />
          ) : (
            <EmptyState message={`No customers match "${search}".`} />
          )
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="focusable font-medium text-indigo-600 hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{customer.email}</td>
                  <td className="px-4 py-3">{customer.company_name || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge status={customer.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CustomerCreateModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CustomerCreateModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", company_name: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await customersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        company_name: form.company_name.trim() || null,
      });
      onSaved();
    } catch (err) {
      // BR-2: duplicate email 409 surfaces inline on the email field
      if (err.status === 409) {
        setErrors({ email: "A customer with this email already exists." });
      } else {
        setErrors({ email: err.message });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Create customer" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <FormField label="Name" htmlFor="cust-name" error={errors.name}>
          <TextInput
            id="cust-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            placeholder="Acme Inc"
            autoFocus
          />
        </FormField>
        <FormField label="Email" htmlFor="cust-email" error={errors.email}>
          <TextInput
            id="cust-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
            placeholder="billing@acme.com"
          />
        </FormField>
        <FormField label="Company" htmlFor="cust-company" hint="Optional">
          <TextInput
            id="cust-company"
            value={form.company_name}
            onChange={(e) =>
              setForm({ ...form, company_name: e.target.value })
            }
            placeholder="Acme"
          />
        </FormField>
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Create customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
