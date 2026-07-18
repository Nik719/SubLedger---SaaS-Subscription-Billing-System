import { Link, useParams } from "react-router-dom";

import { invoicesApi } from "../../api/resources";
import Badge from "../../components/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";
import { money, shortDate } from "../../utils/format";

/** C2 (list): invoices with status badges; row → read-only detail. */
export default function PortalInvoices() {
  const { customerId } = useParams();
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
        <EmptyState message="No invoices yet. Your invoices will appear here once billing starts." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.map((invoice) => (
            <li key={invoice.id}>
              <Link
                to={`/portal/${customerId}/invoices/${invoice.id}`}
                className="focusable flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
              >
                <span>
                  <span className="block font-medium text-gray-900">
                    Invoice #{invoice.id}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {shortDate(invoice.period_start)} –{" "}
                    {shortDate(invoice.period_end)} · Due{" "}
                    {shortDate(invoice.due_date)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="amount font-medium text-gray-900">
                    {money(invoice.amount_due, invoice.currency)}
                  </span>
                  <Badge status={invoice.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
