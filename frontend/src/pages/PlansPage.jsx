import { useState } from "react";

import { plansApi } from "../api/resources";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import { EmptyState, ErrorState, SkeletonRows } from "../components/DataState";
import { useApi } from "../hooks/useApi";
import { money } from "../utils/format";
import PlanFormModal from "./PlanFormModal";

/** A2 Plans list + A3 create/edit (modal). */
export default function PlansPage() {
  const { data: plans, loading, error, refetch } = useApi(plansApi.list);
  const [formPlan, setFormPlan] = useState(null); // null=closed, {}=create, plan=edit
  const [deactivating, setDeactivating] = useState(null);
  const [busy, setBusy] = useState(false);

  const deactivate = async () => {
    setBusy(true);
    try {
      await plansApi.update(deactivating.id, { status: "inactive" });
      setDeactivating(null);
      refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Plans</h1>
        <Button onClick={() => setFormPlan({})}>Create plan</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <SkeletonRows rows={4} cols={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : plans.length === 0 ? (
          <EmptyState
            message="No plans yet. Create your first subscription plan."
            actionLabel="Create plan"
            onAction={() => setFormPlan({})}
          />
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Billing cycle</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {plan.name}
                    {plan.description && (
                      <span className="block text-xs font-normal text-gray-400">
                        {plan.description}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{plan.billing_cycle}</td>
                  <td className="amount px-4 py-3 text-right text-gray-900">
                    {money(plan.amount ?? plan.price, plan.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={plan.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setFormPlan(plan)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={plan.status === "inactive"}
                        title={
                          plan.status === "inactive"
                            ? "Plan is already inactive"
                            : undefined
                        }
                        onClick={() => setDeactivating(plan)}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formPlan !== null && (
        <PlanFormModal
          plan={formPlan.id ? formPlan : null}
          onClose={() => setFormPlan(null)}
          onSaved={() => {
            setFormPlan(null);
            refetch();
          }}
        />
      )}

      {deactivating && (
        <ConfirmDialog
          title={`Deactivate ${deactivating.name}?`}
          consequence="New subscriptions to this plan will be blocked. Existing subscriptions are unaffected."
          confirmLabel="Deactivate plan"
          busy={busy}
          onConfirm={deactivate}
          onCancel={() => setDeactivating(null)}
        />
      )}
    </div>
  );
}
