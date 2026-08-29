export interface InstrumentType {
  id: string;
  name: string;
  description: string | null;
  default_unit: string | null;
}

export interface Instrument {
  id: string;
  owner_id: string;
  instrument_type_id: string;

  instrument_name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string;

  registration_number: string | null;

  capacity: string | number | null;
  capacity_unit: string | null;
  accuracy_class: string | null;

  location_address: string | null;
  location_lat: string | number | null;
  location_lng: string | number | null;

  registration_date: string | null;
  status: string;

  created_at: string;
  updated_at: string;

  instrument_type_name?: string;
  owner_name?: string;
}

export interface CreateInstrumentData {
  instrumentTypeId: string;
  instrumentName: string;
  serialNumber: string;

  manufacturer?: string;
  model?: string;

  capacity?: number;
  capacityUnit?: string;
  accuracyClass?: string;

  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
}