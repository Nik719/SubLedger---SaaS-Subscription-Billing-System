import { useState } from "react";

import { plansApi } from "../api/resources";
import Button from "../components/Button";
import { FormField, Select, TextInput } from "../components/FormField";
import Modal from "../components/Modal";

/** A3 Plan create/edit. BR-1 (price > 0) validated inline before submit;
 * server errors surface inline per Design.md 8. */
export default function PlanFormModal({ plan, onClose, onSaved }) {
  const editing = Boolean(plan);
  const [form, setForm] = useState({
    name: plan?.name || "",
    description: plan?.description || "",
    billing_cycle: plan?.billing_cycle || "monthly",
    price: plan?.price || "",
    currency: plan?.currency || "USD",
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.price || Number(form.price) <= 0)
      next.price = "Price must be greater than 0.";
    if (!/^[A-Z]{3}$/.test(form.currency))
      next.currency = "Use a 3-letter currency code, e.g. USD.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setServerError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        billing_cycle: form.billing_cycle,
        price: form.price,
        currency: form.currency,
      };
      if (editing) {
        await plansApi.update(plan.id, payload);
      } else {
        await plansApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${plan.name}` : "Create plan"}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <FormField label="Name" htmlFor="plan-name" error={errors.name}>
          <TextInput
            id="plan-name"
            value={form.name}
            onChange={set("name")}
            error={errors.name}
            placeholder="Pro Monthly"
            autoFocus
          />
        </FormField>

        <FormField label="Description" htmlFor="plan-desc">
          <TextInput
            id="plan-desc"
            value={form.description}
            onChange={set("description")}
            placeholder="Optional"
          />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Billing cycle" htmlFor="plan-cycle">
            <Select
              id="plan-cycle"
              value={form.billing_cycle}
              onChange={set("billing_cycle")}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </FormField>

          <FormField
            label="Price"
            htmlFor="plan-price"
            error={errors.price}
            hint="Must be greater than 0"
          >
            <TextInput
              id="plan-price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={set("price")}
              error={errors.price}
              placeholder="29.99"
            />
          </FormField>

          <FormField
            label="Currency"
            htmlFor="plan-currency"
            error={errors.currency}
          >
            <TextInput
              id="plan-currency"
              value={form.currency}
              onChange={(event) =>
                setForm({
                  ...form,
                  currency: event.target.value.toUpperCase(),
                })
              }
              error={errors.currency}
              maxLength={3}
            />
          </FormField>
        </div>

        {serverError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-red-600" role="alert">
            {serverError}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
