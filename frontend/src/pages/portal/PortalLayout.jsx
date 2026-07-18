import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";

import { customersApi } from "../../api/resources";
import { auth } from "../../auth";
import Badge from "../../components/Badge";
import { ErrorState, SkeletonRows } from "../../components/DataState";
import { useApi } from "../../hooks/useApi";

/** Portal shell per Design.md 4: centered, max 960px, responsive to 360px. */
export default function PortalLayout() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { data: customer, loading, error, refetch } = useApi(
    () => customersApi.get(customerId),
    [customerId]
  );

  return (
    <div className="mx-auto min-h-screen max-w-[960px] px-4 py-6 sm:px-6">
      <a
        href="#portal-content"
        className="focusable sr-only rounded-lg bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            SubLedger portal
          </p>
          {loading ? (
            <div className="mt-1 h-6 w-40 animate-pulse rounded bg-gray-200" />
          ) : customer ? (
            <span className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {customer.name}
              </h1>
              <Badge status={customer.status} />
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!auth.isAdmin) auth.clear();
            navigate("/portal", { replace: true });
          }}
          className="focusable text-xs text-indigo-600 hover:underline"
        >
          {auth.isAdmin ? "Switch account" : "Sign out"}
        </button>
      </header>

      <nav
        className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200"
        aria-label="Portal sections"
      >
        {[
          { to: `/portal/${customerId}`, label: "Subscriptions", end: true },
          { to: `/portal/${customerId}/invoices`, label: "Invoices" },
          { to: `/portal/${customerId}/activity`, label: "Activity" },
        ].map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `focusable -mb-px whitespace-nowrap rounded-t-lg px-4 py-2 font-medium ${
                isActive
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main id="portal-content">
        {error ? <ErrorState error={error} onRetry={refetch} /> : <Outlet />}
      </main>
    </div>
  );
}
