// Simple prev/next pager for server-paged lists (pairs with usePagedApi).
// Renders nothing when everything fits on one page.
export default function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0 || pages <= 1) return null;
  return (
    <div className="pager" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
      <button type="button" className="secondary" disabled={page <= 1}
        onClick={() => onPage(page - 1)}>‹ Prev</button>
      <span className="muted">Page {page} of {pages} · {total} total</span>
      <button type="button" className="secondary" disabled={page >= pages}
        onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}
