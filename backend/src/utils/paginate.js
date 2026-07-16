// Shared pagination for list endpoints. Paging is opt-in: a request carrying a
// `page` (or `pageSize`) query param gets a `{ rows, total, page, pageSize }`
// envelope; without it the controller keeps returning a plain array, so small
// lookup lists (courses, staff…) and older callers are unaffected.

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// True when the client asked for a specific page/size.
const isPaged = (query = {}) => query.page != null || query.pageSize != null;

// Clamp the requested page/size and derive Sequelize's limit/offset.
function parsePagination(query = {}, { defaultPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.pageSize, 10) || defaultPageSize)
  );
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

module.exports = { isPaged, parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
