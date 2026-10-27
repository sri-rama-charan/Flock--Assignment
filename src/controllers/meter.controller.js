const meterService = require('../services/meter.service');

async function listMeters(req, res) {
  try {
    const search = req.query.search !== undefined ? req.query.search : req.query.q;
    const page = req.query.page;

    const metersData = await meterService.searchMeters({
      query: search,
      page
    });

    return res.status(200).json(metersData);
  } catch (error) {
    if (error.message && (error.message.startsWith('Invalid page') || error.message.startsWith('Invalid query'))) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message && error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Urja Ops portal request timed out. Please try again.' });
    }

    if (error.message && error.message.includes('Unable to connect')) {
      return res.status(503).json({ error: 'Unable to connect to the Urja Ops portal.' });
    }

    if (error.message && error.message.includes('authentication failed')) {
      return res.status(502).json({ error: 'Urja Ops portal authentication failed.' });
    }

    return res.status(500).json({ error: 'Failed to retrieve meters from Urja Ops portal.' });
  }
}

async function getMeterDetails(req, res) {
  try {
    const meterId = req.params.meterId !== undefined ? req.params.meterId : req.params.id;

    const details = await meterService.getMeterDetails(meterId);

    return res.status(200).json(details);
  } catch (error) {
    if (error.status === 400 || (error.message && error.message.startsWith('Invalid meterId'))) {
      return res.status(400).json({ error: error.message });
    }

    if (error.status === 404 || (error.message && error.message.toLowerCase().includes('not found'))) {
      return res.status(404).json({ error: error.message });
    }

    if (error.message && error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Urja Ops portal request timed out. Please try again.' });
    }

    if (error.message && error.message.includes('Unable to connect')) {
      return res.status(503).json({ error: 'Unable to connect to the Urja Ops portal.' });
    }

    if (error.message && error.message.includes('authentication failed')) {
      return res.status(502).json({ error: 'Urja Ops portal authentication failed.' });
    }

    return res.status(500).json({ error: 'Failed to retrieve meter details from Urja Ops portal.' });
  }
}

async function getMeterLocation(req, res) {
  try {
    const meterId = req.params.meterId !== undefined ? req.params.meterId : req.params.id;

    const location = await meterService.getMeterLocation(meterId);

    return res.status(200).json(location);
  } catch (error) {
    if (error.status === 400 || (error.message && error.message.startsWith('Invalid meterId'))) {
      return res.status(400).json({ error: error.message });
    }

    if (error.status === 404 || (error.message && error.message.toLowerCase().includes('not found'))) {
      return res.status(404).json({ error: error.message });
    }

    if (error.message && error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Urja Ops portal request timed out. Please try again.' });
    }

    if (error.message && error.message.includes('Unable to connect')) {
      return res.status(503).json({ error: 'Unable to connect to the Urja Ops portal.' });
    }

    if (error.message && error.message.includes('authentication failed')) {
      return res.status(502).json({ error: 'Urja Ops portal authentication failed.' });
    }

    return res.status(500).json({ error: 'Failed to retrieve meter location from Urja Ops portal.' });
  }
}

module.exports = {
  listMeters,
  getMeterDetails,
  getMeterLocation
};
