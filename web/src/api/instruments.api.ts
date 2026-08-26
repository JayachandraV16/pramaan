import { Instrument, InstrumentType, InstrumentStatus } from '../types';
import { simulateNetworkDelay, getStoredData, setStoredData } from './client';

export const INITIAL_INSTRUMENT_TYPES: InstrumentType[] = [
  {
    id: 'it-01',
    name: 'Non-Automatic Weighing Instrument (NAWI - Electronic Platform Scale)',
    description: 'Heavy duty electronic platform weighing machines used in trade and agro-processing.',
    default_unit: 'kg',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'it-02',
    name: 'Fuel Dispensing Unit (Multi-Product Dispenser MPD)',
    description: 'Commercial petrol and diesel dispensing pumps installed at retail petroleum outlets.',
    default_unit: 'litre',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'it-03',
    name: 'Electronic Precision Analytical Balance (High Precision)',
    description: 'Micro-gram and milli-gram precision balances used in bullion, gold trade, and pharmaceutical testing.',
    default_unit: 'g',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'it-04',
    name: 'Automatic Gravimetric Filling & Packing Machine',
    description: 'Automatic weigh-pack machines used for packaging solid and granular commodities.',
    default_unit: 'kg',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'it-05',
    name: 'Weighbridge (Pitless / Pit Type Electronic Road Weighbridge)',
    description: 'Large commercial vehicle weighbridges up to 100 Metric Tonnes for freight logistics.',
    default_unit: 'tonne',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const INITIAL_INSTRUMENTS: Instrument[] = [
  {
    id: 'inst-001-wb',
    owner_id: 'u-101-owner-001',
    owner_name: 'Rajesh Sharma',
    instrument_type_id: 'it-05',
    instrument_type_name: 'Weighbridge (Pitless / Pit Type Electronic Road Weighbridge)',
    instrument_name: 'Main Freight Weighbridge - 60T',
    manufacturer: 'Avery India Metrology Ltd',
    model: 'AV-WB-6000-X',
    serial_number: 'SN-AV-2024-88910',
    registration_number: 'LM-MH-2024-REG-00412',
    capacity: 60.000,
    capacity_unit: 'tonne',
    accuracy_class: 'Class III (Medium Accuracy)',
    location_address: 'Warehouse Gate 1, APMC Yard, Vashi, Navi Mumbai, Maharashtra 400705',
    location_lat: 19.0760,
    location_lng: 72.9980,
    registration_date: '2024-03-15',
    status: 'ACTIVE',
    created_at: '2024-03-15T10:30:00Z',
    updated_at: '2025-08-20T14:00:00Z',
  },
  {
    id: 'inst-002-ps',
    owner_id: 'u-101-owner-001',
    owner_name: 'Rajesh Sharma',
    instrument_type_id: 'it-01',
    instrument_type_name: 'Non-Automatic Weighing Instrument (NAWI - Electronic Platform Scale)',
    instrument_name: 'Grain Loading Dock Scale #2',
    manufacturer: 'Essae-Teraoka Ltd',
    model: 'DS-215 Heavy Series',
    serial_number: 'SN-ESS-2023-44129',
    registration_number: 'LM-MH-2023-REG-09941',
    capacity: 500.000,
    capacity_unit: 'kg',
    accuracy_class: 'Class III (Medium Accuracy)',
    location_address: 'Loading Shed B, APMC Market Yard, Navi Mumbai 400705',
    location_lat: 19.0768,
    location_lng: 72.9991,
    registration_date: '2023-08-10',
    status: 'ACTIVE',
    created_at: '2023-08-10T09:15:00Z',
    updated_at: '2025-07-12T11:20:00Z',
  },
  {
    id: 'inst-003-pb',
    owner_id: 'u-101-owner-001',
    owner_name: 'Rajesh Sharma',
    instrument_type_id: 'it-03',
    instrument_type_name: 'Electronic Precision Analytical Balance (High Precision)',
    instrument_name: 'Lab QA Precision Balance - 0.1mg',
    manufacturer: 'Mettler Toledo Metrology',
    model: 'ME204T / 00 Analytical',
    serial_number: 'SN-MT-2025-00192',
    registration_number: 'LM-MH-2025-REG-01102',
    capacity: 220.000,
    capacity_unit: 'g',
    accuracy_class: 'Class I (Special Accuracy)',
    location_address: 'Quality Testing Laboratory Room 302, Navi Mumbai 400705',
    location_lat: 19.0772,
    location_lng: 72.9975,
    registration_date: '2025-01-20',
    status: 'ACTIVE',
    created_at: '2025-01-20T11:00:00Z',
    updated_at: '2025-01-20T11:00:00Z',
  },
  {
    id: 'inst-004-mpd',
    owner_id: 'u-101-owner-001',
    owner_name: 'Rajesh Sharma',
    instrument_type_id: 'it-02',
    instrument_type_name: 'Fuel Dispensing Unit (Multi-Product Dispenser MPD)',
    instrument_name: 'Diesel Commercial Dispenser Bay 1',
    manufacturer: 'Tokheim Metrology Systems',
    model: 'Quantium 510M 4-Nozzle',
    serial_number: 'SN-TKH-2024-77182',
    registration_number: 'LM-MH-2024-REG-05531',
    capacity: 80.000,
    capacity_unit: 'litre',
    accuracy_class: 'Class 0.5 (Commercial Fuel Accuracy)',
    location_address: 'Fleet Refueling Station, APMC Sector 19, Navi Mumbai 400705',
    location_lat: 19.0745,
    location_lng: 72.9950,
    registration_date: '2024-06-11',
    status: 'REGISTERED',
    created_at: '2024-06-11T16:45:00Z',
    updated_at: '2025-08-01T09:00:00Z',
  },
  {
    id: 'inst-005-ag',
    owner_id: 'u-101-owner-001',
    owner_name: 'Rajesh Sharma',
    instrument_type_id: 'it-04',
    instrument_type_name: 'Automatic Gravimetric Filling & Packing Machine',
    instrument_name: 'Rice Bagging High-Speed Filler',
    manufacturer: 'Chronos Richardson',
    model: 'E-55 Automatic Bagging Scale',
    serial_number: 'SN-CHR-2022-33100',
    registration_number: 'LM-MH-2022-REG-00812',
    capacity: 50.000,
    capacity_unit: 'kg',
    accuracy_class: 'Class X(1) Automatic',
    location_address: 'Packaging Line 4, Sharma Agro Mill, Navi Mumbai',
    location_lat: 19.0780,
    location_lng: 72.9965,
    registration_date: '2022-11-04',
    status: 'INACTIVE',
    created_at: '2022-11-04T14:10:00Z',
    updated_at: '2025-02-14T10:00:00Z',
  },
];

const INSTRUMENTS_KEY = 'instruments_list';
const TYPES_KEY = 'instrument_types_list';

export interface CreateInstrumentPayload {
  instrument_type_id: string;
  instrument_name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  capacity: number;
  capacity_unit: string;
  accuracy_class: string;
  location_address: string;
  location_lat?: number;
  location_lng?: number;
  owner_id?: string;
  owner_name?: string;
}

export const instrumentsApi = {
  /**
   * Get all instrument types
   */
  async getInstrumentTypes(): Promise<InstrumentType[]> {
    await simulateNetworkDelay(100, 250);
    // TODO: Replace with real fetch('/api/v1/instrument-types')
    return getStoredData<InstrumentType[]>(TYPES_KEY, INITIAL_INSTRUMENT_TYPES);
  },

  /**
   * List instruments with optional filtering by owner, status, or search query
   */
  async listInstruments(params?: {
    ownerId?: string;
    status?: InstrumentStatus;
    search?: string;
    typeId?: string;
  }): Promise<Instrument[]> {
    await simulateNetworkDelay(200, 400);
    // TODO: Replace with real fetch('/api/v1/instruments?' + new URLSearchParams(params as any))
    let list = getStoredData<Instrument[]>(INSTRUMENTS_KEY, INITIAL_INSTRUMENTS);

    if (params?.ownerId) {
      list = list.filter((i) => i.owner_id === params.ownerId);
    }
    if (params?.status) {
      list = list.filter((i) => i.status === params.status);
    }
    if (params?.typeId) {
      list = list.filter((i) => i.instrument_type_id === params.typeId);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.instrument_name.toLowerCase().includes(q) ||
          i.serial_number.toLowerCase().includes(q) ||
          (i.registration_number && i.registration_number.toLowerCase().includes(q)) ||
          i.manufacturer.toLowerCase().includes(q) ||
          i.location_address.toLowerCase().includes(q)
      );
    }

    return list;
  },

  /**
   * Get single instrument by ID
   */
  async getInstrumentById(id: string): Promise<Instrument | null> {
    await simulateNetworkDelay(150, 300);
    // TODO: Replace with real fetch(`/api/v1/instruments/${id}`)
    const list = getStoredData<Instrument[]>(INSTRUMENTS_KEY, INITIAL_INSTRUMENTS);
    return list.find((i) => i.id === id) || null;
  },

  /**
   * Register a new instrument
   */
  async createInstrument(payload: CreateInstrumentPayload): Promise<Instrument> {
    await simulateNetworkDelay(300, 600);
    // TODO: Replace with real fetch('/api/v1/instruments', { method: 'POST', body: JSON.stringify(payload) })
    
    const types = getStoredData<InstrumentType[]>(TYPES_KEY, INITIAL_INSTRUMENT_TYPES);
    const selectedType = types.find((t) => t.id === payload.instrument_type_id);

    const newInst: Instrument = {
      id: `inst-${Date.now()}`,
      owner_id: payload.owner_id || 'u-101-owner-001',
      owner_name: payload.owner_name || 'Rajesh Sharma',
      instrument_type_id: payload.instrument_type_id,
      instrument_type_name: selectedType?.name || 'General Instrument',
      instrument_name: payload.instrument_name,
      manufacturer: payload.manufacturer,
      model: payload.model,
      serial_number: payload.serial_number,
      registration_number: `LM-MH-${new Date().getFullYear()}-REG-${Math.floor(10000 + Math.random() * 90000)}`,
      capacity: Number(payload.capacity),
      capacity_unit: payload.capacity_unit || 'kg',
      accuracy_class: payload.accuracy_class,
      location_address: payload.location_address,
      location_lat: payload.location_lat || 19.0760,
      location_lng: payload.location_lng || 72.9980,
      registration_date: new Date().toISOString().split('T')[0],
      status: 'REGISTERED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const list = getStoredData<Instrument[]>(INSTRUMENTS_KEY, INITIAL_INSTRUMENTS);
    const updatedList = [newInst, ...list];
    setStoredData(INSTRUMENTS_KEY, updatedList);

    return newInst;
  },

  /**
   * Update instrument status or details
   */
  async updateInstrument(id: string, updates: Partial<Instrument>): Promise<Instrument> {
    await simulateNetworkDelay(200, 400);
    // TODO: Replace with real fetch(`/api/v1/instruments/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    const list = getStoredData<Instrument[]>(INSTRUMENTS_KEY, INITIAL_INSTRUMENTS);
    const index = list.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Instrument with ID ${id} not found.`);
    }

    const updated = {
      ...list[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    setStoredData(INSTRUMENTS_KEY, list);
    return updated;
  },
};
