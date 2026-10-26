const meterService = require('../services/meter.service');

/**
 * Controller handler to list or search meters with pagination.
 * Reads 'search' and 'page' query parameters and returns JSON payload.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function listMeters(req, res) {
  try {
    // Read query parameters (supports both 'search' and alias 'q')
    const search = req.query.search !== undefined ? req.query.search : req.query.q;
    const page = req.query.page;

    const metersData = await meterService.searchMeters({
      query: search,
      page
    });

    return res.status(200).json(metersData);
  } catch (error) {
    // Handle input validation errors with HTTP 400
    if (error.message && (error.message.startsWith('Invalid page') || error.message.startsWith('Invalid query'))) {
      return res.status(400).json({ error: error.message });
    }

    // Handle portal timeout errors with HTTP 504
    if (error.message && error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Urja Ops portal request timed out. Please try again.' });
    }

    // Handle portal connection errors with HTTP 503
    if (error.message && error.message.includes('Unable to connect')) {
      return res.status(503).json({ error: 'Unable to connect to the Urja Ops portal.' });
    }

    // Handle upstream auth failure with HTTP 502
    if (error.message && error.message.includes('authentication failed')) {
      return res.status(502).json({ error: 'Urja Ops portal authentication failed.' });
    }

    // Default safe error response avoiding leakage of credentials or internals
    return res.status(500).json({ error: 'Failed to retrieve meters from Urja Ops portal.' });
  }
}

/**
 * Controller handler to retrieve details for a specific meter.
 * Reads 'meterId' from req.params and returns JSON payload.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getMeterDetails(req, res) {
  try {
    const meterId = req.params.meterId !== undefined ? req.params.meterId : req.params.id;

    const details = await meterService.getMeterDetails(meterId);

    return res.status(200).json(details);
  } catch (error) {
    // Handle input validation errors with HTTP 400
    if (error.status === 400 || (error.message && error.message.startsWith('Invalid meterId'))) {
      return res.status(400).json({ error: error.message });
    }

    // Handle not found errors with HTTP 404
    if (error.status === 404 || (error.message && error.message.toLowerCase().includes('not found'))) {
      return res.status(404).json({ error: error.message });
    }

    // Handle portal timeout errors with HTTP 504
    if (error.message && error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Urja Ops portal request timed out. Please try again.' });
    }

    // Handle portal connection errors with HTTP 503
    if (error.message && error.message.includes('Unable to connect')) {
      return res.status(503).json({ error: 'Unable to connect to the Urja Ops portal.' });
    }

    // Handle upstream auth failure with HTTP 502
    if (error.message && error.message.includes('authentication failed')) {
      return res.status(502).json({ error: 'Urja Ops portal authentication failed.' });
    }

    // Default safe error response avoiding leakage of credentials or internals
    return res.status(500).json({ error: 'Failed to retrieve meter details from Urja Ops portal.' });
  }
}

/**
 * Controller handler to retrieve location coordinates for a specific meter.
 * Reads 'meterId' from req.params and returns JSON payload.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getMeterLocation(req, res) {
  try {
    const meterId = req.params.meterId !== undefined ? req.params.meterId : req.params.id;

    const location = await meterService.getMeterLocation(meterId);

    return res.status(200).json(location);
  } catch (error) {
    // Handle input validation errors with HTTP 400
    if (error.status === 400 || (error.message && error.message.startsWith('Invalid meterId'))) {
      return res.status(400).json({ error: error.message });
    }

    // Handle not found errors with HTTP 404
    if (error.status === 404 || (error.message && error.message.toLowerCase().includes('not found'))) {
      return res.status(404).json({ error: error.message });
    }

    // Handle portal timeout errors with HTTP 504
    if (error.message && error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Urja Ops portal request timed out. Please try again.' });
    }

    // Handle portal connection errors with HTTP 503
    if (error.message && error.message.includes('Unable to connect')) {
      return res.status(503).json({ error: 'Unable to connect to the Urja Ops portal.' });
    }

    // Handle upstream auth failure with HTTP 502
    if (error.message && error.message.includes('authentication failed')) {
      return res.status(502).json({ error: 'Urja Ops portal authentication failed.' });
    }

    // Default safe error response avoiding leakage of credentials or internals
    return res.status(500).json({ error: 'Failed to retrieve meter location from Urja Ops portal.' });
  }
}

module.exports = {
  listMeters,
  getMeterDetails,
  getMeterLocation
};
