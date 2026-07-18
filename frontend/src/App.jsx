import { BrowserRouter, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import LoginPage from "./pages/LoginPage";
import CustomersPage from "./pages/CustomersPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import OverviewPage from "./pages/OverviewPage";
import PlansPage from "./pages/PlansPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import PortalInvoiceDetail from "./pages/portal/PortalInvoiceDetail";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalLedger from "./pages/portal/PortalLedger";
import PortalPicker from "./pages/portal/PortalPicker";
import PortalSubscriptions from "./pages/portal/PortalSubscriptions";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Admin dashboard */}
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        </Route>

        {/* Customer portal (read-only) */}
        <Route path="/portal" element={<PortalPicker />} />
        <Route path="/portal/:customerId" element={<PortalLayout />}>
          <Route index element={<PortalSubscriptions />} />
          <Route path="invoices" element={<PortalInvoices />} />
          <Route path="invoices/:invoiceId" element={<PortalInvoiceDetail />} />
          <Route path="activity" element={<PortalLedger />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
