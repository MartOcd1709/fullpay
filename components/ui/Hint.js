export function Hint({ label, term, children }) {
  return (
    <span title={term} className="cursor-help underline decoration-dotted decoration-ink-muted underline-offset-4">
      {label ?? children}
      <span className="sr-only"> ({term})</span>
    </span>
  );
}

export default Hint;
