/** Design.md 6: label above input, inline error below in danger-600. */

export function FormField({ label, htmlFor, error, hint, children }) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="mb-1 block font-medium text-gray-900"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ id, error, ...props }) {
  return (
    <input
      id={id}
      className={`focusable h-9 w-full rounded-lg border bg-white px-3 text-gray-900 placeholder:text-gray-400 ${
        error ? "border-red-600" : "border-gray-200"
      }`}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
}

export function Select({ id, error, children, ...props }) {
  return (
    <select
      id={id}
      className={`focusable h-9 w-full rounded-lg border bg-white px-3 text-gray-900 ${
        error ? "border-red-600" : "border-gray-200"
      }`}
      aria-invalid={Boolean(error)}
      {...props}
    >
      {children}
    </select>
  );
}
