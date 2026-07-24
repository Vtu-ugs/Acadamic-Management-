import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

// Small data-loading hook: returns { data, loading, error, reload }
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    api.get(path)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
     
  }, [path]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps);

  return { data, loading, error, reload };
}

// Server-paged data-loading hook for large lists. Appends page/pageSize to the
// request and expects the `{ rows, total, page, pageSize }` envelope. `path` is
// the base path (may already carry a query string, e.g. a status filter);
// changing it resets back to page 1.
export function usePagedApi(path, { pageSize = 50 } = {}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reset to the first page whenever the base path (filters) changes.
  useEffect(() => { setPage(1); }, [path]);

  const sep = path.includes('?') ? '&' : '?';
  const url = `${path}${sep}page=${page}&pageSize=${pageSize}`;

  const reload = useCallback(() => {
    setLoading(true);
    api.get(url)
      .then((d) => { setRows(d.rows || []); setTotal(d.total || 0); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  useEffect(() => { reload(); }, [reload]);

  return { rows, total, page, pageSize, setPage, loading, error, reload };
}
