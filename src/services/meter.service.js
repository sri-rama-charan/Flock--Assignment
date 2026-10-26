const portalClient = require('../clients/portal.client');

/**
 * Validate that the page parameter is a positive integer.
 * @param {any} page - Page number input
 * @returns {number} - Validated integer page >= 1
 */
function validatePage(page) {
  const parsed = Number(page);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid page: page must be a positive integer greater than or equal to 1.');
  }
  return parsed;
}

/**
 * Validate and clean the search text parameter.
 * @param {any} query - Search text input
 * @returns {string} - Cleaned search string
 */
function validateQuery(query) {
  if (query === undefined || query === null) {
    return '';
  }
  if (typeof query !== 'string') {
    throw new Error('Invalid query: search value must be a string.');
  }
  return query.trim();
}

/**
 * Search and list meters from the Urja Ops portal with pagination.
 *
 * @param {object} [options={}]
 * @param {string} [options.query=''] - Search term to filter by serialNo, meterId, etc.
 * @param {number|string} [options.page=1] - Page number for pagination
 * @returns {Promise<{ data: Array, total: number, page: number, pageSize: number }>}
 */
async function searchMeters(options = {}) {
  const rawQuery = options.query !== undefined ? options.query : (options.q !== undefined ? options.q : '');
  const rawPage = options.page !== undefined ? options.page : 1;

  const validQuery = validateQuery(rawQuery);
  const validPage = validatePage(rawPage);

  // Use Axios params config so query parameters are serialized safely
  const response = await portalClient.get('/portal/meters/search', {
    params: {
      q: validQuery,
      page: validPage
    }
  });

  return {
    data: response.data || [],
    total: response.total !== undefined ? response.total : 0,
    page: response.page !== undefined ? response.page : validPage,
    pageSize: response.pageSize !== undefined ? response.pageSize : 0
  };
}

module.exports = {
  searchMeters,
  getMeters: searchMeters
};
