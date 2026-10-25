const createInstrumentRules = {
  instrumentTypeId: { required: true, type: 'string' },
  instrumentName: { required: true, type: 'string' },
  serialNumber: { required: true, type: 'string' },

  manufacturer: { required: false, type: 'string' },
  model: { required: false, type: 'string' },

  capacity: { required: false, type: 'number' },
  capacityUnit: { required: false, type: 'string' },
  accuracyClass: { required: false, type: 'string' },

  locationAddress: { required: false, type: 'string' },
  locationLat: { required: false, type: 'number' },
  locationLng: { required: false, type: 'number' },
};

module.exports = {
  createInstrumentRules,
};