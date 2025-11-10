// pagination.js
// Comprehensive pagination utilities for IgniteFitness API

const crypto = require('crypto');

/**
 * Pagination configuration
 */
const PAGINATION_CONFIG = {
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 20,
  CURSOR_VERSION: 1
};

/**
 * Validate and normalize pagination parameters
 * @param {Object} queryParams - Query parameters from request
 * @returns {Object} Normalized pagination parameters
 */
function validatePaginationParams(queryParams = {}) {
  const parsedLimit = parseInt(queryParams.limit);
  const limit = Math.min(
    Math.max(isNaN(parsedLimit) ? PAGINATION_CONFIG.DEFAULT_LIMIT : parsedLimit, PAGINATION_CONFIG.MIN_LIMIT),
    PAGINATION_CONFIG.MAX_LIMIT
  );

  const cursor = queryParams.cursor || null;
  const before = queryParams.before || null;
  const after = queryParams.after || null;

  return {
    limit,
    cursor,
    before,
    after,
    offset: queryParams.offset ? Math.max(0, parseInt(queryParams.offset)) : 0
  };
}

/**
 * Decode cursor for pagination
 * @param {string} cursor - Base64 encoded cursor
 * @returns {Object} Decoded cursor data
 */
function decodeCursor(cursor) {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());

    if (decoded.v !== PAGINATION_CONFIG.CURSOR_VERSION) {
      throw new Error('Unsupported cursor version');
    }

    return {
      id: decoded.id,
      timestamp: decoded.timestamp,
      order: decoded.order,
      v: decoded.v,
      version: decoded.v // For backward compatibility
    };
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Encode cursor for pagination
 * @param {Object} data - Data to encode in cursor
 * @returns {string} Base64 encoded cursor
 */
function encodeCursor(data) {
  const cursorData = {
    id: data.id,
    timestamp: data.timestamp,
    order: data.order,
    v: PAGINATION_CONFIG.CURSOR_VERSION
  };

  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

/**
 * Create pagination response
 * @param {Array} items - Items to return
 * @param {number} limit - Requested limit
 * @param {Function} getCursorData - Function to get cursor data from last item
 * @param {Object} options - Additional options
 * @returns {Object} Paginated response
 */
function createPaginatedResponse(items, limit, getCursorData, options = {}) {
  const hasMore = items.length > limit;
  const returnItems = hasMore ? items.slice(0, limit) : items;

  let nextCursor = null;
  if (hasMore && returnItems.length > 0) {
    const lastItem = returnItems[returnItems.length - 1];
    const cursorData = getCursorData(lastItem);
    nextCursor = encodeCursor(cursorData);
  }

  const response = {
    data: returnItems,
    pagination: {
      limit,
      has_more: hasMore,
      count: returnItems.length,
      next_cursor: nextCursor
    }
  };

  // Add total count if requested and available
  if (options.includeTotal && options.total !== undefined) {
    response.pagination.total = options.total;
  }

  // Add previous cursor if available
  if (options.previousCursor) {
    response.pagination.previous_cursor = options.previousCursor;
  }

  return response;
}

/**
 * Build SQL WHERE clause for cursor-based pagination
 * @param {string} cursor - Cursor string
 * @param {string} orderBy - Order by column (e.g., 'created_at DESC, id ASC')
 * @param {string} tableAlias - Table alias (optional)
 * @returns {Object} SQL condition and values
 */
function buildCursorCondition(cursor, orderBy = 'created_at DESC, id ASC', tableAlias = '') {
  if (!cursor) {
    return { condition: '', values: [] };
  }

  try {
    const decoded = decodeCursor(cursor);
    const alias = tableAlias ? `${tableAlias}.` : '';

    // Parse order by to determine cursor condition
    const orderParts = orderBy.split(',').map(part => part.trim());
    const conditions = [];
    const values = [];

    if (orderParts.includes('created_at DESC') || orderParts.includes('created_at ASC')) {
      if (orderParts.includes('created_at DESC')) {
        conditions.push(`${alias}created_at < $${values.length + 1}`);
      } else {
        conditions.push(`${alias}created_at > $${values.length + 1}`);
      }
      values.push(decoded.timestamp);
    }

    if (orderParts.includes('id ASC') || orderParts.includes('id DESC')) {
      if (orderParts.includes('id ASC')) {
        conditions.push(`${alias}id > $${values.length + 1}`);
      } else {
        conditions.push(`${alias}id < $${values.length + 1}`);
      }
      values.push(decoded.id);
    }

    if (orderParts.includes('start_at DESC') || orderParts.includes('start_at ASC')) {
      if (orderParts.includes('start_at DESC')) {
        conditions.push(`${alias}start_at < $${values.length + 1}`);
      } else {
        conditions.push(`${alias}start_at > $${values.length + 1}`);
      }
      values.push(decoded.timestamp);
    }

    return {
      condition: conditions.length > 0 ? `AND (${conditions.join(' OR ')})` : '',
      values
    };
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Build SQL WHERE clause for timestamp-based pagination
 * @param {string} before - Before timestamp
 * @param {string} after - After timestamp
 * @param {string} timestampColumn - Column name for timestamp
 * @param {string} tableAlias - Table alias (optional)
 * @returns {Object} SQL condition and values
 */
function buildTimestampCondition(before, after, timestampColumn = 'created_at', tableAlias = '') {
  const conditions = [];
  const values = [];
  const alias = tableAlias ? `${tableAlias}.` : '';

  if (before) {
    conditions.push(`${alias}${timestampColumn} < $${values.length + 1}`);
    values.push(before);
  }

  if (after) {
    conditions.push(`${alias}${timestampColumn} > $${values.length + 1}`);
    values.push(after);
  }

  return {
    condition: conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '',
    values
  };
}

/**
 * Get cursor data from an item for different entity types
 * @param {Object} item - Database item
 * @param {string} type - Entity type ('sessions', 'exercises', 'users', etc.)
 * @returns {Object} Cursor data
 */
function getCursorDataForItem(item, type) {
  switch (type) {
    case 'sessions':
      return {
        id: item.id,
        timestamp: item.start_at || item.created_at,
        order: item.start_at || item.created_at
      };

    case 'exercises':
      return {
        id: item.id,
        timestamp: item.created_at,
        order: item.order_index || item.created_at
      };

    case 'users':
      return {
        id: item.id,
        timestamp: item.created_at,
        order: item.created_at
      };

    case 'sleep_sessions':
      return {
        id: item.id,
        timestamp: item.start_at || item.created_at,
        order: item.start_at || item.created_at
      };

    case 'strava_activities':
      return {
        id: item.id,
        timestamp: item.start_date || item.created_at,
        order: item.start_date || item.created_at
      };

    default:
      return {
        id: item.id,
        timestamp: item.created_at,
        order: item.created_at
      };
  }
}

/**
 * Validate pagination parameters and return errors
 * @param {Object} queryParams - Query parameters
 * @returns {Array} Array of validation errors
 */
function validatePaginationInput(queryParams = {}) {
  const errors = [];

  // Validate limit
  if (queryParams.limit !== undefined) {
    const limit = parseInt(queryParams.limit);
    if (isNaN(limit) || limit < PAGINATION_CONFIG.MIN_LIMIT || limit > PAGINATION_CONFIG.MAX_LIMIT) {
      errors.push(`Limit must be between ${PAGINATION_CONFIG.MIN_LIMIT} and ${PAGINATION_CONFIG.MAX_LIMIT}`);
    }
  }

  // Validate offset
  if (queryParams.offset !== undefined) {
    const offset = parseInt(queryParams.offset);
    if (isNaN(offset) || offset < 0) {
      errors.push('Offset must be a non-negative integer');
    }
  }

  // Validate cursor
  if (queryParams.cursor) {
    try {
      decodeCursor(queryParams.cursor);
    } catch (error) {
      errors.push('Invalid cursor format');
    }
  }

  // Validate before/after timestamps
  if (queryParams.before) {
    const beforeDate = new Date(queryParams.before);
    if (isNaN(beforeDate.getTime())) {
      errors.push('Invalid before timestamp format');
    }
  }

  if (queryParams.after) {
    const afterDate = new Date(queryParams.after);
    if (isNaN(afterDate.getTime())) {
      errors.push('Invalid after timestamp format');
    }
  }

  return errors;
}

/**
 * Create pagination metadata for response
 * @param {Object} pagination - Pagination object
 * @param {string} baseUrl - Base URL for pagination links
 * @param {Object} queryParams - Original query parameters
 * @returns {Object} Pagination metadata with links
 */
function createPaginationMetadata(pagination, baseUrl, queryParams = {}) {
  const metadata = {
    ...pagination,
    links: {}
  };

  if (pagination.next_cursor) {
    const nextParams = new URLSearchParams({
      ...queryParams,
      cursor: pagination.next_cursor
    });
    metadata.links.next = `${baseUrl}?${nextParams.toString()}`;
  }

  if (pagination.previous_cursor) {
    const prevParams = new URLSearchParams({
      ...queryParams,
      cursor: pagination.previous_cursor
    });
    metadata.links.previous = `${baseUrl}?${prevParams.toString()}`;
  }

  return metadata;
}

module.exports = {
  PAGINATION_CONFIG,
  validatePaginationParams,
  decodeCursor,
  encodeCursor,
  createPaginatedResponse,
  buildCursorCondition,
  buildTimestampCondition,
  getCursorDataForItem,
  validatePaginationInput,
  createPaginationMetadata
};
