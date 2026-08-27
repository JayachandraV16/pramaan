const repo = require('./instrument-types.repository');

async function getInstrumentTypes() {
  return repo.findActiveInstrumentTypes();
}

module.exports = {
  getInstrumentTypes,
};
