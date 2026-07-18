/** Tiny auth store (Phase 9). Token persisted in localStorage. */

const KEY = "subledger_auth";

export const auth = {
  get session() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  },
  get token() {
    return this.session?.access_token || null;
  },
  get isAdmin() {
    return this.session?.role === "admin";
  },
  get customerId() {
    return this.session?.role === "customer" ? this.session.customer_id : null;
  },
  save(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
