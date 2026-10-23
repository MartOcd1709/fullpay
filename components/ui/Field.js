// Visible label on every field; hint and error are tied in with aria-describedby; errors set aria-invalid.
export function Field({ id, label, hint, error, children, className = "", labelExtra }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-1">
        <label htmlFor={id} className="font-semibold">{label}</label>
        {labelExtra}
      </div>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-ink-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}

const described = (id, hint, error) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function Input({ id, hint, error, className = "", ...props }) {
  return <input id={id} name={props.name ?? id} className={`field ${className}`} aria-invalid={error ? "true" : undefined} aria-describedby={described(id, hint, error)} {...props} />;
}

export function Select({ id, hint, error, className = "", children, ...props }) {
  return (
    <select id={id} name={props.name ?? id} className={`field ${className}`} aria-invalid={error ? "true" : undefined} aria-describedby={described(id, hint, error)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ id, hint, error, className = "", ...props }) {
  return <textarea id={id} name={props.name ?? id} className={`field ${className}`} aria-invalid={error ? "true" : undefined} aria-describedby={described(id, hint, error)} {...props} />;
}

export function Check({ id, label, hint, className = "", ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3">
        <input type="checkbox" id={id} name={props.name ?? id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
        <span className="font-medium">{label}</span>
      </label>
      {hint && <p id={`${id}-hint`} className="ml-9 text-ink-muted">{hint}</p>}
    </div>
  );
}
