/** Status badge — canonical mapping from Design.md 5. Pill + leading dot. */

const STYLES = {
  active: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  success: "bg-green-50 text-green-700",
  partially_paid: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  failed: "bg-red-50 text-red-700",
  issued: "bg-blue-50 text-blue-700",
  draft: "bg-gray-50 text-gray-600 border border-gray-200",
  inactive: "bg-gray-50 text-gray-600 border border-gray-200",
  cancelled: "bg-gray-50 text-gray-600 border border-gray-200",
  void: "bg-gray-50 text-gray-600 border border-gray-200 line-through",
};

const DOTS = {
  active: "bg-green-600",
  paid: "bg-green-600",
  success: "bg-green-600",
  partially_paid: "bg-amber-600",
  overdue: "bg-red-600",
  failed: "bg-red-600",
  issued: "bg-blue-600",
};

export default function Badge({ status }) {
  const style = STYLES[status] || STYLES.draft;
  const dot = DOTS[status] || "bg-gray-400";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {status.replace("_", " ")}
    </span>
  );
}
