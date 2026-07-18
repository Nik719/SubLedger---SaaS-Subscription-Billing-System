import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { customersApi, invoicesApi, subscriptionsApi } from "../api/resources";
import Badge from "../components/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../components/DataState";
import { useApi } from "../hooks/useApi";
import { dateTime, money, shortDate } from "../utils/format";

/** A5 Customer detail: profile header + Subscriptions / Invoices / Ledger tabs. */
export default function CustomerDetailPage() {
  const { id } = useParams();
  const [tab, setTab] = useState("subscriptions");
  const { data: customer, loading, error, refetch } = useApi(
    () => customersApi.get(id),
    [id]
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <SkeletonRows rows={3} cols={3} />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <Link
        to="/customers"
        className="focusable mb-4 inline-block text-indigo-600 hover:underline"
      >
        ← Customers
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {customer.name}
            </h1>
            <p className="text-gray-600">
              {customer.email}
              {customer.company_name && ` · ${customer.company_name}`}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Customer since {shortDate(customer.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/portal/${customer.id}`}
              className="focusable text-xs text-indigo-600 hover:underline"
            >
              View portal ↗
            </Link>
            <Badge status={customer.status} />
          </div>
        </div>
      </div>

      <div
        className="mb-4 flex gap-1 border-b border-gray-200"
        role="tablist"
        aria-label="Customer details"
      >
        {[
          { id: "subscriptions", label: "Subscriptions" },
          { id: "invoices", label: "Invoices" },
          { id: "ledger", label: "Ledger" },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`focusable -mb-px rounded-t-lg px-4 py-2 font-medium ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "subscriptions" && <SubscriptionsTab customerId={id} />}
      {tab === "invoices" && <InvoicesTab customerId={id} />}
      {tab === "ledger" && <LedgerTab customerId={id} />}
    </div>
  );
}

function SubscriptionsTab({ customerId }) {
  const { data, loading, error, refetch } = useApi(
    () => subscriptionsApi.list({ customer_id: customerId }),
    [customerId]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading ? (
        <SkeletonRows rows={3} cols={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState message="No subscriptions for this customer yet." />
      ) : (
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Current period</th>
              <th className="px-4 py-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {data.map((sub) => (
              <tr key={sub.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  Plan #{sub.plan_id}
                </td>
                <td className="px-4 py-3">
                  <Badge status={sub.status} />
                </td>
                <td className="px-4 py-3">
                  {shortDate(sub.current_period_start)} –{" "}
                  {shortDate(sub.current_period_end)}
                </td>
                <td className="px-4 py-3">{shortDate(sub.start_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InvoicesTab({ customerId }) {
  const { data, loading, error, refetch } = useApi(
    () => invoicesApi.list({ customer_id: customerId }),
    [customerId]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading ? (
        <SkeletonRows rows={3} cols={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState message="No invoices for this customer yet. Generate one from an active subscription." />
      ) : (
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 text-right font-medium">Due</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Due date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((invoice) => (
              <tr key={invoice.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="focusable font-medium text-indigo-600 hover:underline"
                  >
                    #{invoice.id}
                  </Link>
                </td>
                <td className="amount px-4 py-3 text-right text-gray-900">
                  {money(invoice.amount_due, invoice.currency)}
                </td>
                <td className="amount px-4 py-3 text-right">
                  {money(invoice.amount_paid, invoice.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge status={invoice.status} />
                </td>
                <td className="px-4 py-3">{shortDate(invoice.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const ENTRY_ICONS = {
  invoice_created: { icon: "▤", style: "bg-blue-50 text-blue-600" },
  payment_success: { icon: "✓", style: "bg-green-50 text-green-600" },
  payment_failure: { icon: "✕", style: "bg-red-50 text-red-600" },
};

/** Ledger timeline per Design.md 6 — read-only, no edit/delete affordances. */
function LedgerTab({ customerId }) {
  const { data, loading, error, refetch } = useApi(
    () => customersApi.ledger(customerId),
    [customerId]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading ? (
        <SkeletonRows rows={3} cols={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState message="No ledger activity yet. Entries appear when invoices are generated and payments are recorded." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.map((entry) => {
            const meta = ENTRY_ICONS[entry.entry_type] || ENTRY_ICONS.invoice_created;
            return (
              <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.style}`}
                  aria-hidden="true"
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {entry.entry_type.replace(/_/g, " ")}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    <span className="font-mono">{entry.reference_id}</span>
                    {entry.description && ` · ${entry.description}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="amount font-medium text-gray-900">
                    {money(entry.amount, entry.currency)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {dateTime(entry.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
