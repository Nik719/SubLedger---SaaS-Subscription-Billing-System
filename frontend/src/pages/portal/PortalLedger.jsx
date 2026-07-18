import { useParams } from "react-router-dom";

import { customersApi } from "../../api/resources";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";
import { dateTime, money } from "../../utils/format";

const ENTRY_META = {
  invoice_created: { icon: "▤", style: "bg-blue-50 text-blue-600", label: "Invoice issued" },
  payment_success: { icon: "✓", style: "bg-green-50 text-green-600", label: "Payment received" },
  payment_failure: { icon: "✕", style: "bg-red-50 text-red-600", label: "Payment failed" },
};

/** C3: read-only chronological activity feed. */
export default function PortalLedger() {
  const { customerId } = useParams();
  const { data, loading, error, refetch } = useApi(
    () => customersApi.ledger(customerId),
    [customerId]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState message="No activity yet. Billing events will appear here." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.map((entry) => {
            const meta = ENTRY_META[entry.entry_type] || ENTRY_META.invoice_created;
            return (
              <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.style}`}
                  aria-hidden="true"
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{meta.label}</p>
                  <p className="truncate text-xs text-gray-400">
                    Invoice #{entry.invoice_id} ·{" "}
                    <span className="font-mono">{entry.reference_id}</span>
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
