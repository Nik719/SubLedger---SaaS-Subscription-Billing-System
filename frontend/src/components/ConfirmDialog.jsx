import Button from "./Button";
import Modal from "./Modal";

/** Design.md 6: confirmation dialog must state the consequence. */
export default function ConfirmDialog({
  title,
  consequence,
  confirmLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Keep as is
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-gray-600">{consequence}</p>
    </Modal>
  );
}
