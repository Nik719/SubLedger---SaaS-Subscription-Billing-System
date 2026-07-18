import { Link, useParams } from "react-router-dom";

import { invoicesApi } from "../../api/resources";
import Badge from "../../components/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";
import { dateTime, money, shortDate } from "../../utils/format";

/** C2 (detail): read-only — amounts, period, payment history. */
export default function PortalInvoiceDetail() {
  const { customerId, invoiceId } = useParams();
  const invoiceState = useApi(() => invoicesApi.get(invoiceId), [invoiceId]);
  const attemptsState = useApi(() => invoicesApi.payments(invoiceId), [invoiceId]);

  const { data: invoice, loading, error, refetch } = invoiceState;

  if (loading)
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <SkeletonRows rows={3} cols={3} />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  // Guard: don't render another customer's invoice through URL editing
  if (String(invoice.customer_id) !== String(customerId)) {
    return (
      <ErrorState
        error={{ message: "This invoice belongs to a different account." }}
      />
    );
  }

  const paid = Number(invoice.amount_paid);
  const due = Number(invoice.amount_due);
  const progress = due > 0 ? Math.min(100, (paid / due) * 100) : 0;

  return (
    <div>
      <Link
        to={`/portal/${customerId}/invoices`}
        className="focusable mb-4 inline-block text-indigo-600 hover:underline"
      >
        ← All invoices
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Invoice #{invoice.id}
          </h2>
          <Badge status={invoice.status} />
        </div>
        <p className="mb-2 text-gray-600">
          <span className="amount font-semibold text-gray-900">
            {money(invoice.amount_paid, invoice.currency)}
          </span>{" "}
          paid of{" "}
          <span className="amount">
            {money(invoice.amount_due, invoice.currency)}
          </span>
        </p>
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
        <p className="mt-3 text-xs text-gray-400">
          Billing period {shortDate(invoice.period_start)} –{" "}
          {shortDate(invoice.period_end)} · Due {shortDate(invoice.due_date)}
        </p>
      </div>

      <h3 className="mb-3 text-lg font-semibold text-gray-900">
        Payment history
      </h3>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {attemptsState.loading ? (
          <SkeletonRows rows={2} cols={3} />
        ) : attemptsState.error ? (
          <ErrorState error={attemptsState.error} onRetry={attemptsState.refetch} />
        ) : attemptsState.data.length === 0 ? (
          <EmptyState message="No payments recorded for this invoice yet." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {attemptsState.data.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span>
                  <span className="amount block font-medium text-gray-900">
                    {money(attempt.amount, invoice.currency)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {dateTime(attempt.created_at)}
                    {attempt.failure_reason && ` · ${attempt.failure_reason}`}
                  </span>
                </span>
                <Badge status={attempt.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
