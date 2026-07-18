/** One function per backend endpoint (PRD 6). */

import { api } from "./client";

export const plansApi = {
  list: () => api.get("/plans"),
  create: (data) => api.post("/plans", data),
  update: (id, data) => api.patch(`/plans/${id}`, data),
};

export const customersApi = {
  list: () => api.get("/customers"),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post("/customers", data),
  ledger: (id) => api.get(`/customers/${id}/ledger`),
};

export const subscriptionsApi = {
  list: (params) => api.get("/subscriptions", params),
  create: (data) => api.post("/subscriptions", data),
  cancel: (id) => api.patch(`/subscriptions/${id}/cancel`),
};

export const invoicesApi = {
  list: (params) => api.get("/invoices", params),
  get: (id) => api.get(`/invoices/${id}`),
  payments: (id) => api.get(`/invoices/${id}/payments`),
  generate: (data) => api.post("/invoices/generate", data),
};

export const paymentsApi = {
  record: (data) => api.post("/payments/record", data),
};

export const ledgerApi = {
  recent: (limit = 20) => api.get("/ledger", { limit }),
};

export const authApi = {
  login: (data) => api.post("/auth/login", data),
};
