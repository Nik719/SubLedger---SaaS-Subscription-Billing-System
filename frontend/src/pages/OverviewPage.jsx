import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  invoicesApi,
  ledgerApi,
  plansApi,
  subscriptionsApi,
} from "../api/resources";
import { ErrorState, SkeletonRows } from "../components/DataState";
import { useApi } from "../hooks/useApi";
import { dateTime, money } from "../utils/format";

/** A1 Overview: KPI cards + recent ledger activity feed. */
export default function OverviewPage() {
  const subsState = useApi(() => subscriptionsApi.list({ status: "active" }));
  const plansState = useApi(plansApi.list);
  const overdueState = useApi(() => invoicesApi.list({ status: "overdue" }));
  const ledgerState = useApi(() => ledgerApi.recent(10));

  const loading =
    subsState.loading ||
    plansState.loading ||
    overdueState.loading ||
    ledgerState.loading;
  const error =
    subsState.error || plansState.error || overdueState.error || ledgerState.error;

  const kpis = useMemo(() => {
    if (loading || error) return null;
    const planById = new Map(plansState.data.map((p) => [p.id, p]));

    // MRR proxy (PRD A1): sum of active subscriptions' plan prices,
    // normalized to monthly. Mixed currencies are summed per currency.
    const mrrByCurrency = {};
    const divisor = { monthly: 1, quarterly: 3, yearly: 12 };
    for (const sub of subsState.data) {
      const plan = planById.get(sub.plan_id);
      if (!plan) continue;
      const monthly = Number(plan.price) / (divisor[plan.billing_cycle] || 1);
      mrrByCurrency[plan.currency] = (mrrByCurrency[plan.currency] || 0) + monthly;
    }
    const mrr = Object.entries(mrrByCurrency)
      .map(([currency, value]) => money(value.toFixed(2), currency))
      .join(" + ");

    const today = new Date().toDateString();
    const paymentsToday = ledgerState.data.filter(
      (e) =>
        e.entry_type === "payment_success" &&
        new Date(e.created_at).toDateString() === today
    ).length;

    return [
      { label: "Active subscriptions", value: subsState.data.length },
      { label: "MRR (proxy)", value: mrr || "—", isAmount: true },
      { label: "Overdue invoices", value: overdueState.data.length },
      { label: "Payments today", value: paymentsToday },
    ];
  }, [loading, error, subsState.data, plansState.data, overdueState.data, ledgerState.data]);

  if (error) {
    return <ErrorState error={error} onRetry={subsState.refetch} />;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Overview</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white"
              />
            ))
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs text-gray-600">{kpi.label}</p>
                <p
                  className={`mt-1 text-2xl font-semibold text-gray-900 ${
                    kpi.isAmount ? "amount" : ""
                  }`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
      </div>

      <h2 className="mb-3 text-xl font-semibold text-gray-900">
        Recent activity
      </h2>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <SkeletonRows rows={4} cols={3} />
        ) : ledgerState.data.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-600">
            No activity yet. Ledger entries appear when invoices are generated
            and payments are recorded.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ledgerState.data.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    entry.entry_type === "payment_success"
                      ? "bg-green-50 text-green-600"
                      : entry.entry_type === "payment_failure"
                        ? "bg-red-50 text-red-600"
                        : "bg-blue-50 text-blue-600"
                  }`}
                  aria-hidden="true"
                >
                  {entry.entry_type === "payment_success"
                    ? "✓"
                    : entry.entry_type === "payment_failure"
                      ? "✕"
                      : "▤"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {entry.entry_type.replace(/_/g, " ")}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    <Link
                      to={`/customers/${entry.customer_id}`}
                      className="focusable hover:underline"
                    >
                      Customer #{entry.customer_id}
                    </Link>{" "}
                    ·{" "}
                    <Link
                      to={`/invoices/${entry.invoice_id}`}
                      className="focusable hover:underline"
                    >
                      Invoice #{entry.invoice_id}
                    </Link>
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
