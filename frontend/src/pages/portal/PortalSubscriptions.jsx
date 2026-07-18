import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { plansApi, subscriptionsApi } from "../../api/resources";
import Badge from "../../components/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";
import { money, shortDate } from "../../utils/format";

/** C1: subscription cards — plan, price, cycle, status, current period. */
export default function PortalSubscriptions() {
  const { customerId } = useParams();
  const subsState = useApi(
    () => subscriptionsApi.list({ customer_id: customerId }),
    [customerId]
  );
  const plansState = useApi(plansApi.list);

  const planById = useMemo(
    () => new Map((plansState.data || []).map((p) => [p.id, p])),
    [plansState.data]
  );

  const { data, loading, error, refetch } = subsState;

  if (loading || plansState.loading)
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <SkeletonRows rows={2} cols={3} />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (data.length === 0)
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <EmptyState message="You have no subscriptions yet." />
      </div>
    );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.map((sub) => {
        const plan = planById.get(sub.plan_id);
        return (
          <article
            key={sub.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            aria-label={plan ? plan.name : `Subscription ${sub.id}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900">
                {plan ? plan.name : `Plan #${sub.plan_id}`}
              </h2>
              <Badge status={sub.status} />
            </div>
            {plan && (
              <p className="amount mb-3 text-2xl font-semibold text-gray-900">
                {money(plan.price, plan.currency)}
                <span className="text-sm font-normal text-gray-400">
                  {" "}
                  / {plan.billing_cycle}
                </span>
              </p>
            )}
            <dl className="text-xs text-gray-600">
              <div className="flex justify-between border-t border-gray-100 py-1.5">
                <dt>Current period</dt>
                <dd>
                  {shortDate(sub.current_period_start)} –{" "}
                  {shortDate(sub.current_period_end)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 py-1.5">
                <dt>Member since</dt>
                <dd>{shortDate(sub.start_date)}</dd>
              </div>
              {sub.cancelled_at && (
                <div className="flex justify-between border-t border-gray-100 py-1.5">
                  <dt>Cancelled</dt>
                  <dd>{shortDate(sub.cancelled_at)}</dd>
                </div>
              )}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
