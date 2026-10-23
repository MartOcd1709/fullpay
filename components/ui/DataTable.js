// A real <table> from sm up; below sm each row becomes a card whose cells show their header (.cardify in globals.css).
// columns: [{ key, label, render?(row), align?: "right", primary?: true }]; render runs where the table renders (server or client).
export function DataTable({ columns, rows, caption, rowKey = (r) => r.id, empty = null, className = "" }) {
  if (!rows?.length) return empty;
  return (
    <div className={`sm:overflow-x-auto sm:rounded-xl sm:border sm:border-line sm:bg-surface ${className}`}>
      <table className="cardify w-full border-collapse text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-2 text-sm text-ink-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="sm:border-t sm:border-line">
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.primary ? "" : typeof c.label === "string" ? c.label : c.key}
                  data-primary={c.primary ? "" : undefined}
                  className={`sm:px-4 sm:py-3 sm:align-top ${c.align === "right" ? "sm:text-right" : ""}`}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
