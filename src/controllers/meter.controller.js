const meterService = require('../services/meter.service');

function sendErrorResponse(res, error, defaultMessage) {
  const status = error.status || error.statusCode || 500;
  let code = error.code;
  let message = error.message;

  if (status === 400 && !code) {
    code = 'BAD_REQUEST';
  } else if (status === 404 && !code) {
    code = 'NOT_FOUND';
  } else if (status === 502 && !code) {
    code = 'BAD_GATEWAY';
  } else if (status === 503 && !code) {
    code = 'SERVICE_UNAVAILABLE';
  } else if (status === 504 && !code) {
    code = 'GATEWAY_TIMEOUT';
  } else if (status >= 500 && !code) {
    code = 'INTERNAL_SERVER_ERROR';
    message = defaultMessage || 'An unexpected internal server error occurred.';
  }

  return res.status(status).json({
    error: {
      code: code || 'INTERNAL_SERVER_ERROR',
      message: message || defaultMessage || 'An unexpected error occurred.'
    }
  });
}

async function listMeters(req, res, next) {
  try {
    const search = req.query.search !== undefined ? req.query.search : req.query.q;
    const page = req.query.page;

    const metersData = await meterService.searchMeters({
      query: search,
      page
    });

    return res.status(200).json(metersData);
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to retrieve meters from Urja Ops portal.');
  }
}

async function getMeterDetails(req, res, next) {
  try {
    const meterId = req.params.meterId !== undefined ? req.params.meterId : req.params.id;

    const details = await meterService.getMeterDetails(meterId);

    return res.status(200).json(details);
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to retrieve meter details from Urja Ops portal.');
  }
}

async function getMeterLocation(req, res, next) {
  try {
    const meterId = req.params.meterId !== undefined ? req.params.meterId : req.params.id;

    const location = await meterService.getMeterLocation(meterId);

    return res.status(200).json(location);
  } catch (error) {
    return sendErrorResponse(res, error, 'Failed to retrieve meter location from Urja Ops portal.');
  }
}

module.exports = {
  listMeters,
  getMeterDetails,
  getMeterLocation
};
