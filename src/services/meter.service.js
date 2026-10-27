const portalClient = require('../clients/portal.client');

function validatePage(page) {
  if (page === undefined) {
    return 1;
  }
  if (page === null || page === '' || typeof page === 'boolean' || Array.isArray(page)) {
    const error = new Error('Invalid page: page must be a positive integer greater than or equal to 1.');
    error.status = 400;
    error.code = 'INVALID_PAGE';
    throw error;
  }
  const str = String(page).trim();
  if (!/^\d+$/.test(str)) {
    const error = new Error('Invalid page: page must be a positive integer greater than or equal to 1.');
    error.status = 400;
    error.code = 'INVALID_PAGE';
    throw error;
  }
  const parsed = Number(str);
  if (parsed < 1 || parsed > 1000000 || !Number.isSafeInteger(parsed)) {
    const error = new Error('Invalid page: page must be a positive integer between 1 and 1,000,000.');
    error.status = 400;
    error.code = 'INVALID_PAGE';
    throw error;
  }
  return parsed;
}

function validateQuery(query) {
  if (query === undefined || query === null) {
    return '';
  }
  if (typeof query !== 'string') {
    const error = new Error('Invalid query: search value must be a string.');
    error.status = 400;
    error.code = 'INVALID_QUERY';
    throw error;
  }
  if (query.length > 200) {
    const error = new Error('Invalid query: search query exceeds maximum allowed length of 200 characters.');
    error.status = 400;
    error.code = 'INVALID_QUERY';
    throw error;
  }
  return query.trim();
}

function validateMeterId(meterId) {
  if (meterId === undefined || meterId === null) {
    const error = new Error('Invalid meterId: meterId is required.');
    error.status = 400;
    error.code = 'INVALID_METER_ID';
    throw error;
  }
  if (typeof meterId !== 'string') {
    const error = new Error('Invalid meterId: meterId must be a string.');
    error.status = 400;
    error.code = 'INVALID_METER_ID';
    throw error;
  }
  const trimmed = meterId.trim();
  if (trimmed === '') {
    const error = new Error('Invalid meterId: meterId must be a non-empty string.');
    error.status = 400;
    error.code = 'INVALID_METER_ID';
    throw error;
  }
  if (trimmed.length > 100) {
    const error = new Error('Invalid meterId: meterId exceeds maximum allowed length of 100 characters.');
    error.status = 400;
    error.code = 'INVALID_METER_ID';
    throw error;
  }
  if (trimmed === '.' || trimmed === '..' || /[\r\n\0]/.test(trimmed)) {
    const error = new Error('Invalid meterId: meterId contains invalid characters.');
    error.status = 400;
    error.code = 'INVALID_METER_ID';
    throw error;
  }
  return trimmed;
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
    const error = new Error('Invalid response received from Urja Ops portal.');
    error.status = 502;
    error.code = 'UPSTREAM_INVALID_RESPONSE';
    throw error;
  }

  const nodes = sveltekitPayload.nodes;
  if (!Array.isArray(nodes)) {
    const error = new Error('Unexpected data format received from Urja Ops portal.');
    error.status = 502;
    error.code = 'UPSTREAM_INVALID_RESPONSE';
    throw error;
  }

  for (const node of nodes) {
    if (node && node.type === 'error') {
      const message = node.error && node.error.message ? node.error.message : `Meter '${meterId}' not found on Urja Ops portal.`;
      const error = new Error(message);
      error.status = node.status || 404;
      error.code = 'METER_NOT_FOUND';
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
  notFoundError.code = 'METER_NOT_FOUND';
  throw notFoundError;
}

async function searchMeters(options = {}) {
  const rawQuery = options.query !== undefined ? options.query : (options.q !== undefined ? options.q : undefined);
  const rawPage = options.page !== undefined ? options.page : undefined;

  const validQuery = rawQuery !== undefined ? validateQuery(rawQuery) : '';
  const validPage = validatePage(rawPage);

  const response = await portalClient.get('/portal/meters/search', {
    params: {
      q: validQuery,
      page: validPage
    }
  });

  const rawData = response && Array.isArray(response.data) ? response.data : [];
  const total = typeof response?.total === 'number' && Number.isFinite(response.total) ? response.total : rawData.length;
  const page = typeof response?.page === 'number' && Number.isFinite(response.page) ? response.page : validPage;
  const pageSize = typeof response?.pageSize === 'number' && Number.isFinite(response.pageSize) ? response.pageSize : rawData.length;

  return {
    data: rawData,
    total,
    page,
    pageSize
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
      const err = new Error(`Malformed or missing location data for meter '${validMeterId}'.`);
      err.status = 502;
      err.code = 'UPSTREAM_INVALID_RESPONSE';
      throw err;
    }

    const { latitude, longitude } = response.data;
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      const err = new Error(`Location data incomplete for meter '${validMeterId}'.`);
      err.status = 502;
      err.code = 'UPSTREAM_INVALID_RESPONSE';
      throw err;
    }

    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    if (isNaN(latNum) || isNaN(lonNum)) {
      const err = new Error(`Location coordinates for meter '${validMeterId}' are not valid numbers.`);
      err.status = 502;
      err.code = 'INVALID_LOCATION_COORDINATES';
      throw err;
    }

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      const err = new Error(`Location coordinates for meter '${validMeterId}' are outside valid geographic range.`);
      err.status = 502;
      err.code = 'INVALID_LOCATION_COORDINATES';
      throw err;
    }

    return {
      latitude: String(latitude),
      longitude: String(longitude),
      data: response.data
    };
  } catch (error) {
    if (error.status === 404 || (error.message && error.message.includes('404'))) {
      const notFoundError = new Error(`Location not found for meter '${validMeterId}'.`);
      notFoundError.status = 404;
      notFoundError.code = 'LOCATION_NOT_FOUND';
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
