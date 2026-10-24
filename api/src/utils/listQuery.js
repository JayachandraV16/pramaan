// api/src/utils/listQuery.js
//
// Search / filter / sort / pagination for list endpoints.
//
//   ?search=abc            case-insensitive match on any of the configured fields
//   ?status=ACTIVE         exact match per configured filter (comma separated = any of)
//   ?sort=created_at&order=desc   sort by one of the configured sortable fields
//   ?page=2&limit=20       pagination (limit capped at 100)
//
// Backward compatible: when neither `page` nor `limit` is sent the result is
// the plain (filtered) array, exactly what existing clients already expect.
// When paging is requested the result is
//   { items, total, page, limit, totalPages }
//
// Filtering happens in memory on the role-scoped result set. That is fine for
// the data volumes of a district/state deployment; move it into SQL when a
// single user can see tens of thousands of rows.

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function text(value) {
  return value === null || value === undefined ? '' : String(value).toLowerCase();
}

function applyListQuery(items, query = {}, options = {}) {
  const { searchFields = [], filters = {}, sortFields = [] } = options;
  let result = Array.isArray(items) ? items : [];

  for (const [param, field] of Object.entries(filters)) {
    const raw = query[param];
    if (raw === undefined || raw === '') continue;
    const wanted = String(raw).toLowerCase().split(',').map((v) => v.trim()).filter(Boolean);
    result = result.filter((item) => wanted.includes(text(item[field])));
  }

  const needle = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
  if (needle) {
    result = result.filter((item) => searchFields.some((field) => text(item[field]).includes(needle)));
  }

  if (query.sort && sortFields.includes(query.sort)) {
    const direction = String(query.order).toLowerCase() === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const av = a[query.sort];
      const bv = b[query.sort];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av > bv ? 1 : -1) * direction;
    });
  }

  if (query.page === undefined && query.limit === undefined) {
    return result;
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const total = result.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(parseInt(query.page, 10) || 1, 1), totalPages);
  return {
    items: result.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    totalPages,
  };
}

module.exports = { applyListQuery, MAX_LIMIT, DEFAULT_LIMIT };
