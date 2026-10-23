export function EmptyState({ title, description, action }) {
  return (
    <section className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-prose text-ink-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

export default EmptyState;
