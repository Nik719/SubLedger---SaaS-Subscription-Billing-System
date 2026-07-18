import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  customersApi,
  invoicesApi,
  plansApi,
  subscriptionsApi,
} from "../api/resources";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import { EmptyState, ErrorState, SkeletonRows } from "../components/DataState";
import { FormField, Select } from "../components/FormField";
import Modal from "../components/Modal";
import { useApi } from "../hooks/useApi";
import { shortDate } from "../utils/format";

/** A6 Subscriptions list + A7 create + A8 generate-invoice action. */
export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const { data: subs, loading, error, refetch } = useApi(
    () => subscriptionsApi.list(statusFilter ? { status: statusFilter } : {}),
    [statusFilter]
  );
  const { data: plans } = useApi(plansApi.list);
  const { data: customers } = useApi(customersApi.list);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState(null);

  const planName = useMemo(() => {
    const map = new Map((plans || []).map((p) => [p.id, p.name]));
    return (id) => map.get(id) || `Plan #${id}`;
  }, [plans]);

  const customerName = useMemo(() => {
    const map = new Map((customers || []).map((c) => [c.id, c.name]));
    return (id) => map.get(id) || `Customer #${id}`;
  }, [customers]);

  const cancelSub = async () => {
    setBusy(true);
    try {
      await subscriptionsApi.cancel(cancelling.id);
      setCancelling(null);
      refetch();
    } finally {
      setBusy(false);
    }
  };

  const generateInvoice = async (sub) => {
    setRowError(null);
    try {
      const invoice = await invoicesApi.generate({ subscription_id: sub.id });
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      // duplicate period → jump to the existing invoice (Design.md 8)
      if (err.status === 409 && err.details?.existing_invoice_id) {
        navigate(`/invoices/${err.details.existing_invoice_id}`);
      } else {
        setRowError({ id: sub.id, message: err.message });
      }
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
        <Button onClick={() => setCreating(true)}>Create subscription</Button>
      </div>

      <div className="mb-4 max-w-[180px]">
        <Select
          id="sub-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <SkeletonRows rows={4} cols={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : subs.length === 0 ? (
          <EmptyState
            message={
              statusFilter
                ? `No ${statusFilter} subscriptions.`
                : "No subscriptions yet. Subscribe a customer to a plan."
            }
            actionLabel={statusFilter ? undefined : "Create subscription"}
            onAction={() => setCreating(true)}
          />
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Current period</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${sub.customer_id}`}
                      className="focusable font-medium text-indigo-600 hover:underline"
                    >
                      {customerName(sub.customer_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {planName(sub.plan_id)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={sub.status} />
                  </td>
                  <td className="px-4 py-3">
                    {shortDate(sub.current_period_start)} –{" "}
                    {shortDate(sub.current_period_end)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        disabled={sub.status !== "active"}
                        title={
                          sub.status !== "active"
                            ? "Only active subscriptions can be invoiced"
                            : undefined
                        }
                        onClick={() => generateInvoice(sub)}
                      >
                        Generate invoice
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={sub.status === "cancelled"}
                        title={
                          sub.status === "cancelled"
                            ? "Subscription is already cancelled"
                            : undefined
                        }
                        onClick={() => setCancelling(sub)}
                      >
                        Cancel
                      </Button>
                    </div>
                    {rowError?.id === sub.id && (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        {rowError.message}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <SubscriptionCreateModal
          plans={plans || []}
          customers={customers || []}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refetch();
          }}
        />
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancel this subscription?"
          consequence={`${customerName(cancelling.customer_id)} will keep access data, but no new invoices can be generated for this subscription. This cannot be undone.`}
          confirmLabel="Cancel subscription"
          busy={busy}
          onConfirm={cancelSub}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}

/** A7: inactive plans are excluded from the picker (BR-3 by construction);
 * BR-4 409 surfaces with a link to the existing subscription. */
function SubscriptionCreateModal({ plans, customers, onClose, onSaved }) {
  const activePlans = plans.filter((p) => p.status === "active");
  const [form, setForm] = useState({ customer_id: "", plan_id: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.customer_id || !form.plan_id) {
      setError({ message: "Choose a customer and a plan." });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await subscriptionsApi.create({
        customer_id: Number(form.customer_id),
        plan_id: Number(form.plan_id),
      });
      onSaved();
    } catch (err) {
      setError({
        message:
          err.status === 409
            ? "This customer already has an active subscription to this plan."
            : err.message,
        existingId: err.details?.existing_subscription_id,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Create subscription" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <FormField label="Customer" htmlFor="sub-customer">
          <Select
            id="sub-customer"
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            autoFocus
          >
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Plan"
          htmlFor="sub-plan"
          hint="Only active plans can receive new subscriptions"
        >
          <Select
            id="sub-plan"
            value={form.plan_id}
            onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
          >
            <option value="">Choose a plan…</option>
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.price} {p.currency} / {p.billing_cycle}
              </option>
            ))}
          </Select>
        </FormField>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-red-600" role="alert">
            {error.message}{" "}
            {error.existingId && (
              <span className="text-gray-600">
                (subscription #{error.existingId})
              </span>
            )}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Create subscription"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
