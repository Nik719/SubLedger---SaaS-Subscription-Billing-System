import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";

import { auth } from "../auth";

/** Admin shell per Design.md 4: fixed 240px sidebar, content max 1200px. */

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/plans", label: "Plans" },
  { to: "/customers", label: "Customers" },
  { to: "/subscriptions", label: "Subscriptions" },
];

export default function Layout() {
  const navigate = useNavigate();

  if (!auth.isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#admin-content"
        className="focusable sr-only rounded-lg bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
        <div className="px-5 py-5">
          <span className="text-base font-semibold text-gray-900">
            SubLedger
          </span>
        </div>
        <nav className="px-3" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `focusable mb-1 block rounded-lg px-3 py-2 font-medium ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 border-t border-gray-100 px-3 pt-4">
          <NavLink
            to="/portal"
            className="focusable block rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            Customer portal ↗
          </NavLink>
          <button
            type="button"
            onClick={() => {
              auth.clear();
              navigate("/login", { replace: true });
            }}
            className="focusable block w-full rounded-lg px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1" id="admin-content">
        <div className="mx-auto max-w-content px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
