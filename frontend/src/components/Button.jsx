/** Buttons per Design.md 6: primary / secondary / destructive, 36px default. */

const VARIANTS = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 disabled:hover:bg-indigo-600",
  secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600",
};

export default function Button({
  variant = "primary",
  type = "button",
  disabled,
  title,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      className={`focusable inline-flex h-9 items-center justify-center rounded-lg px-4 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
}
