const portalClient = require('../clients/portal.client');

function validatePage(page) {
  const parsed = Number(page);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid page: page must be a positive integer greater than or equal to 1.');
  }
  return parsed;
}

function validateQuery(query) {
  if (query === undefined || query === null) {
    return '';
  }
  if (typeof query !== 'string') {
    throw new Error('Invalid query: search value must be a string.');
  }
  return query.trim();
}

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

function parseMeterDetailsPayload(sveltekitPayload, meterId) {
  if (!sveltekitPayload || typeof sveltekitPayload !== 'object') {
    throw new Error('Invalid response received from Urja Ops portal.');
  }

  const nodes = sveltekitPayload.nodes;
  if (!Array.isArray(nodes)) {
    throw new Error('Unexpected data format received from Urja Ops portal.');
  }

  for (const node of nodes) {
    if (node && node.type === 'error') {
      const message = node.error && node.error.message ? node.error.message : 'Meter not found';
      const error = new Error(message);
      error.status = node.status || 404;
      throw error;
    }
  }

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

async function searchMeters(options = {}) {
  const rawQuery = options.query !== undefined ? options.query : (options.q !== undefined ? options.q : '');
  const rawPage = options.page !== undefined ? options.page : 1;

  const validQuery = validateQuery(rawQuery);
  const validPage = validatePage(rawPage);

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

async function getMeterDetails(meterId) {
  const validMeterId = validateMeterId(meterId);
  const endpoint = `/meters/${encodeURIComponent(validMeterId)}/__data.json`;
  const response = await portalClient.get(endpoint);

  return parseMeterDetailsPayload(response, validMeterId);
}

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
