// Pagination utility with mandatory limits
class PaginationManager {
  constructor() {
    this.defaultLimit = 20;
    this.maxLimit = 100;
    this.defaultOffset = 0;
  }

  validateAndNormalize(queryParams) {
    const limit = Math.min(parseInt(queryParams.limit) || this.defaultLimit, this.maxLimit);

    const offset = Math.max(parseInt(queryParams.offset) || this.defaultOffset, 0);

    const page = Math.max(parseInt(queryParams.page) || 1, 1);

    // Calculate offset from page if provided
    const calculatedOffset = queryParams.page ? (page - 1) * limit : offset;

    return {
      limit,
      offset: calculatedOffset,
      page: Math.floor(calculatedOffset / limit) + 1,
    };
  }

  buildQuery(baseQuery, pagination, orderBy = 'created_at DESC') {
    // Count existing parameters in base query
    // Handle both $1, $2 format and $ format
    const numberedParams = baseQuery.match(/\$\d+/g) || [];
    const unnumberedParams = baseQuery.match(/\$(?!\d)/g) || [];

    // If numbered params exist, find the highest number
    let paramCount = 0;
    if (numberedParams.length > 0) {
      const maxParam = Math.max(...numberedParams.map(p => parseInt(p.substring(1)) || 0));
      paramCount = maxParam;
    } else {
      paramCount = unnumberedParams.length;
    }

    return `
        ${baseQuery}
        ORDER BY ${orderBy}
        LIMIT $${paramCount + 1}
        OFFSET $${paramCount + 2}
      `;
  }

  buildCountQuery(baseQuery) {
    // Extract FROM clause and WHERE conditions
    const fromIndex = baseQuery.toUpperCase().indexOf('FROM');
    const orderIndex = baseQuery.toUpperCase().lastIndexOf('ORDER BY');

    const fromClause =
      orderIndex > -1
        ? baseQuery.substring(fromIndex, orderIndex).trim()
        : baseQuery.substring(fromIndex).trim();

    return `SELECT COUNT(*) as total ${fromClause}`;
  }

  formatResponse(data, pagination, totalCount) {
    const { limit, offset, page } = pagination;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        offset,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }
}

const paginationManager = new PaginationManager();

module.exports = {
  PaginationManager,
  validatePagination: params => paginationManager.validateAndNormalize(params),
  buildPaginatedQuery: (baseQuery, pagination, orderBy) =>
    paginationManager.buildQuery(baseQuery, pagination, orderBy),
  buildCountQuery: baseQuery => paginationManager.buildCountQuery(baseQuery),
  formatResponse: (data, pagination, total) =>
    paginationManager.formatResponse(data, pagination, total),
};
