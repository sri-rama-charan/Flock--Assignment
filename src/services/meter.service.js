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
 * Validate that the meterId parameter is a non-empty string.
 * @param {any} meterId - Meter identifier input
 * @returns {string} - Validated non-empty trimmed meterId
 */
function validateMeterId(meterId) {
  if (meterId === undefined || meterId === null) {
    const error = new Error('Invalid meterId: meterId is required.');
    error.status = 400;
    throw error;
  }
  if (typeof meterId !== 'string' || meterId.trim() === '') {
    const error = new Error('Invalid meterId: meterId must be a non-empty string.');
    error.status = 400;
    throw error;
  }
  return meterId.trim();
}

/**
 * Unflattens a SvelteKit serialized devalue token array into a JavaScript object graph.
 * SvelteKit's __data.json indexes references to deduplicate and preserve object structures.
 *
 * @param {Array} tokens - Token array from SvelteKit __data.json
 * @param {number} [index=0] - Root index to resolve
 * @returns {any} - Resolved JavaScript value
 */
function unflattenSvelteKitData(tokens, index = 0) {
  const token = tokens[index];
  if (token === null || typeof token !== 'object') {
    return token;
  }
  if (Array.isArray(token)) {
    return token.map((childIndex) => unflattenSvelteKitData(tokens, childIndex));
  }
  const result = {};
  for (const [key, valIndex] of Object.entries(token)) {
    result[key] = typeof valIndex === 'number' ? unflattenSvelteKitData(tokens, valIndex) : valIndex;
  }
  return result;
}

/**
 * Safely parse SvelteKit payload and extract meter details and electrical hierarchy.
 *
 * @param {object} sveltekitPayload - Upstream response from /meters/{meterId}/__data.json
 * @param {string} meterId - Requested meter identifier
 * @returns {{ meterId: string, detail: object, hierarchy: object }}
 */
function parseMeterDetailsPayload(sveltekitPayload, meterId) {
  if (!sveltekitPayload || typeof sveltekitPayload !== 'object') {
    throw new Error('Invalid response received from Urja Ops portal.');
  }

  const nodes = sveltekitPayload.nodes;
  if (!Array.isArray(nodes)) {
    throw new Error('Unexpected data format received from Urja Ops portal.');
  }

  // Check if any node indicates a SvelteKit error (e.g. HTTP 404 Meter not found)
  for (const node of nodes) {
    if (node && node.type === 'error') {
      const message = node.error && node.error.message ? node.error.message : 'Meter not found';
      const error = new Error(message);
      error.status = node.status || 404;
      throw error;
    }
  }

  // Scan nodes for the component data containing meter detail
  for (const node of nodes) {
    if (node && Array.isArray(node.data)) {
      const parsed = unflattenSvelteKitData(node.data, 0);
      if (parsed && (parsed.meterId || parsed.detail || parsed.hierarchy)) {
        return {
          meterId: parsed.meterId || meterId,
          detail: parsed.detail || { data: [] },
          hierarchy: parsed.hierarchy || {}
        };
      }
    }
  }

  const notFoundError = new Error(`Meter '${meterId}' not found on Urja Ops portal.`);
  notFoundError.status = 404;
  throw notFoundError;
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

/**
 * Retrieve details, nameplate parameters, and electrical hierarchy for a specific meter.
 *
 * @param {string} meterId - Meter identifier (e.g. 'J100000')
 * @returns {Promise<{ meterId: string, detail: object, hierarchy: object }>}
 */
async function getMeterDetails(meterId) {
  const validMeterId = validateMeterId(meterId);

  // Request the verified SvelteKit data endpoint for this meter
  const endpoint = `/meters/${encodeURIComponent(validMeterId)}/__data.json`;
  const response = await portalClient.get(endpoint);

  return parseMeterDetailsPayload(response, validMeterId);
}

/**
 * Retrieve geographic location coordinates (latitude, longitude) for a specific meter.
 *
 * @param {string} meterId - Meter identifier (e.g. 'J100000')
 * @returns {Promise<{ latitude: string, longitude: string, data: { latitude: string, longitude: string } }>}
 */
async function getMeterLocation(meterId) {
  const validMeterId = validateMeterId(meterId);

  try {
    const endpoint = `/portal/meters/${encodeURIComponent(validMeterId)}/geo`;
    const response = await portalClient.get(endpoint);

    if (!response || !response.data || typeof response.data !== 'object') {
      throw new Error(`Malformed or missing location data for meter '${validMeterId}'.`);
    }

    const { latitude, longitude } = response.data;
    if (latitude === undefined || longitude === undefined) {
      throw new Error(`Location data incomplete for meter '${validMeterId}'.`);
    }

    return {
      latitude,
      longitude,
      data: response.data
    };
  } catch (error) {
    if (error.message && error.message.includes('status 404')) {
      const notFoundError = new Error(`Location not found for meter '${validMeterId}'.`);
      notFoundError.status = 404;
      throw notFoundError;
    }
    throw error;
  }
}

module.exports = {
  searchMeters,
  getMeters: searchMeters,
  getMeterDetails,
  getMeterLocation
};

