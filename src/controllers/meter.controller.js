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

module.exports = {
  listMeters
};
