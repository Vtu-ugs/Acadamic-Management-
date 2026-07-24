// Shared pagination for list endpoints. Paging is opt-in: a request carrying a
// `page` (or `pageSize`) query param gets a `{ rows, total, page, pageSize }`
// envelope; without it the controller keeps returning a plain array, so small
// lookup lists (courses, staff…) and older callers are unaffected.

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// Safety cap for the un-paginated branch of a list endpoint. Paging is opt-in,
// so a caller that omits `page`/`pageSize` still gets a plain array — but never
// the whole table. Without this, a list grows unbounded with the student
// population (30k fee rows ≈ 28 MB / 2.6 s; linear from there). Callers that
// genuinely need more must page. Kept comfortably above any realistic single
// unpaged view (courses/staff/etc. are in the hundreds).
const UNPAGED_MAX = 1000;

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

module.exports = {
  isPaged, parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, UNPAGED_MAX,
};
