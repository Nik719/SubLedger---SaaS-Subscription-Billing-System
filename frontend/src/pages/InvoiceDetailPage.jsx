import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { invoicesApi, paymentsApi } from "../api/resources";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { EmptyState, ErrorState, SkeletonRows } from "../components/DataState";
import { FormField, Select, TextInput } from "../components/FormField";
import Modal from "../components/Modal";
import { useApi } from "../hooks/useApi";
import { dateTime, money, shortDate } from "../utils/format";

const PAYABLE = new Set(["issued", "partially_paid", "overdue"]);

/** A9 Invoice detail: due vs paid progress, attempts table, record payment. */
export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invoiceState = useApi(() => invoicesApi.get(id), [id]);
  const attemptsState = useApi(() => invoicesApi.payments(id), [id]);
  const [recording, setRecording] = useState(false);

  const { data: invoice, loading, error } = invoiceState;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <SkeletonRows rows={3} cols={3} />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={invoiceState.refetch} />;

  const paid = Number(invoice.amount_paid);
  const due = Number(invoice.amount_due);
  const remaining = (due - paid).toFixed(2);
  const progress = due > 0 ? Math.min(100, (paid / due) * 100) : 0;
  const payable = PAYABLE.has(invoice.status);

  const refetchAll = () => {
    invoiceState.refetch();
    attemptsState.refetch();
  };

  return (
    <div>
      <Link
        to="/subscriptions"
        className="focusable mb-4 inline-block text-indigo-600 hover:underline"
      >
        ← Subscriptions
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Invoice #{invoice.id}
            </h1>
            <p className="text-gray-600">
              <Link
                to={`/customers/${invoice.customer_id}`}
                className="focusable text-indigo-600 hover:underline"
              >
                Customer #{invoice.customer_id}
              </Link>{" "}
              · Subscription #{invoice.subscription_id}
            </p>
          </div>
          <Badge status={invoice.status} />
        </div>

        <div className="mb-2 flex items-end justify-between">
          <p className="text-gray-600">
            <span className="amount font-semibold text-gray-900">
              {money(invoice.amount_paid, invoice.currency)}
            </span>{" "}
            paid of{" "}
            <span className="amount">{money(invoice.amount_due, invoice.currency)}</span>
          </p>
          <p className="text-xs text-gray-400">
            Period {shortDate(invoice.period_start)} –{" "}
            {shortDate(invoice.period_end)} · Due {shortDate(invoice.due_date)}
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Amount paid"
        >
          <div
            className={`h-full rounded-full ${
              invoice.status === "paid" ? "bg-green-600" : "bg-indigo-600"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4">
          <Button
            onClick={() => setRecording(true)}
            disabled={!payable}
            title={
              !payable
                ? `Invoices in status '${invoice.status}' cannot accept payments`
                : undefined
            }
          >
            Record payment
          </Button>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-semibold text-gray-900">
        Payment attempts
      </h2>
      <AttemptsTable state={attemptsState} currency={invoice.currency} />

      {recording && (
        <RecordPaymentModal
          invoice={invoice}
          remaining={remaining}
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            refetchAll();
          }}
        />
      )}
    </div>
  );
}

function AttemptsTable({ state, currency }) {
  const { data, loading, error, refetch } = state;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading ? (
        <SkeletonRows rows={2} cols={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState message="No payment attempts yet. Record the first payment for this invoice." />
      ) : (
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Failure reason</th>
            </tr>
          </thead>
          <tbody>
            {data.map((attempt) => (
              <tr key={attempt.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{dateTime(attempt.created_at)}</td>
                <td className="amount px-4 py-3 text-right text-gray-900">
                  {money(attempt.amount, currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge status={attempt.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {attempt.provider_reference}
                </td>
                <td className="px-4 py-3">{attempt.failure_reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** A10: remaining amount always visible; failure_reason only when failed;
 * BR-6 server errors surface inline. */
function RecordPaymentModal({ invoice, remaining, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: remaining,
    status: "success",
    provider_reference: "",
    failure_reason: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const failed = form.status === "failed";

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.amount || Number(form.amount) <= 0)
      next.amount = "Amount must be greater than 0.";
    if (!failed && Number(form.amount) > Number(remaining))
      next.amount = `A successful payment cannot exceed the remaining ${money(
        remaining,
        invoice.currency
      )}.`;
    if (!form.provider_reference.trim())
      next.provider_reference = "Provider reference is required.";
    if (failed && !form.failure_reason.trim())
      next.failure_reason = "Failure reason is required for failed payments.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await paymentsApi.record({
        invoice_id: invoice.id,
        amount: form.amount,
        currency: invoice.currency,
        status: form.status,
        provider_reference: form.provider_reference.trim(),
        failure_reason: failed ? form.failure_reason.trim() : null,
      });
      onSaved();
    } catch (err) {
      setErrors({ amount: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Record payment" onClose={onClose}>
      <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-gray-600">
        Remaining unpaid:{" "}
        <span className="amount font-semibold text-gray-900">
          {money(remaining, invoice.currency)}
        </span>
      </p>
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Amount" htmlFor="pay-amount" error={errors.amount}>
            <TextInput
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={errors.amount}
              autoFocus
            />
          </FormField>
          <FormField label="Outcome" htmlFor="pay-status">
            <Select
              id="pay-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </Select>
          </FormField>
        </div>

        <FormField
          label="Provider reference"
          htmlFor="pay-ref"
          error={errors.provider_reference}
          hint="Transaction ID from the payment provider"
        >
          <TextInput
            id="pay-ref"
            value={form.provider_reference}
            onChange={(e) =>
              setForm({ ...form, provider_reference: e.target.value })
            }
            error={errors.provider_reference}
            placeholder="txn_12345"
          />
        </FormField>

        {failed && (
          <FormField
            label="Failure reason"
            htmlFor="pay-failure"
            error={errors.failure_reason}
          >
            <TextInput
              id="pay-failure"
              value={form.failure_reason}
              onChange={(e) =>
                setForm({ ...form, failure_reason: e.target.value })
              }
              error={errors.failure_reason}
              placeholder="card_declined"
            />
          </FormField>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
