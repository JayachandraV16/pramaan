import {
  Instrument,
  InstrumentType,
  InstrumentStatus,
  BackendInstrumentResponse,
  BackendInstrumentTypeResponse,
  BackendCreateInstrumentRequest,
} from '../types';
import {
  apiClient,
  getStoredData,
  setStoredData,
} from './client';

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
    capacity: 60.0,
    capacity_unit: 'tonne',
    accuracy_class: 'Class III (Medium Accuracy)',
    location_address: 'Warehouse Gate 1, APMC Yard, Vashi, Navi Mumbai, Maharashtra 400705',
    location_lat: 19.076,
    location_lng: 72.998,
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
    capacity: 500.0,
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
    capacity: 220.0,
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
    capacity: 80.0,
    capacity_unit: 'litre',
    accuracy_class: 'Class 0.5 (Commercial Fuel Accuracy)',
    location_address: 'Fleet Refueling Station, APMC Sector 19, Navi Mumbai 400705',
    location_lat: 19.0745,
    location_lng: 72.995,
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
    capacity: 50.0,
    capacity_unit: 'kg',
    accuracy_class: 'Class X(1) Automatic',
    location_address: 'Packaging Line 4, Sharma Agro Mill, Navi Mumbai',
    location_lat: 19.078,
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

/**
 * Data Mapper: Maps backend instrument response to the frontend Instrument interface
 */
export function mapBackendInstrumentToFrontend(item: BackendInstrumentResponse): Instrument {
  const typeId = item.instrumentTypeId || item.instrument_type_id || 'it-01';
  const typeName =
    item.instrumentTypeName ||
    item.instrument_type_name ||
    INITIAL_INSTRUMENT_TYPES.find((t) => t.id === typeId)?.name ||
    'General Metrology Instrument';

  return {
    id: item.id,
    owner_id: item.ownerId || item.owner_id || 'u-101-owner-001',
    owner_name: item.ownerName || item.owner_name || 'Rajesh Sharma',
    instrument_type_id: typeId,
    instrument_type_name: typeName,
    instrument_name: item.instrumentName || item.instrument_name || item.model || 'Commercial Weighing Instrument',
    manufacturer: item.manufacturer || 'OEM Manufacturer',
    model: item.model || 'Standard Model',
    serial_number: item.serialNumber || item.serial_number || `SN-${item.id}`,
    registration_number: item.registrationNumber ?? item.registration_number ?? null,
    capacity: Number(item.capacity ?? 0),
    capacity_unit: item.capacityUnit || item.capacity_unit || 'kg',
    accuracy_class: item.accuracyClass || item.accuracy_class || 'Class III (Medium Accuracy)',
    location_address: item.locationAddress || item.location_address || 'Operating Premises',
    location_lat: item.locationLat ?? item.location_lat ?? 19.076,
    location_lng: item.locationLng ?? item.location_lng ?? 72.998,
    registration_date:
      item.registrationDate ||
      item.registration_date ||
      (item.createdAt ? item.createdAt.split('T')[0] : item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    status: (item.status as InstrumentStatus) || 'REGISTERED',
    created_at: item.createdAt || item.created_at || new Date().toISOString(),
    updated_at: item.updatedAt || item.updated_at || new Date().toISOString(),
  };
}

/**
 * Data Mapper: Maps backend instrument type response to frontend InstrumentType interface
 */
export function mapBackendInstrumentTypeToFrontend(item: BackendInstrumentTypeResponse): InstrumentType {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    default_unit: item.defaultUnit || item.default_unit || 'kg',
    is_active: item.isActive ?? item.is_active ?? true,
    created_at: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

/**
 * Data Mapper: Maps frontend create payload to backend camelCase request structure
 */
export function mapFrontendCreateDtoToBackend(payload: CreateInstrumentPayload): BackendCreateInstrumentRequest {
  return {
    instrumentTypeId: payload.instrument_type_id,
    instrumentName: payload.instrument_name,
    serialNumber: payload.serial_number,
    manufacturer: payload.manufacturer,
    model: payload.model,
    capacity: Number(payload.capacity),
    capacityUnit: payload.capacity_unit,
    accuracyClass: payload.accuracy_class,
    locationAddress: payload.location_address,
    locationLat: payload.location_lat,
    locationLng: payload.location_lng,
  };
}

export const instrumentsApi = {
  /**
   * Get all instrument types from backend GET /api/instruments/types or fallback
   */
  async getInstrumentTypes(): Promise<InstrumentType[]> {
    try {
      const response = await apiClient.get<BackendInstrumentTypeResponse[]>('/instruments/types');
      if (Array.isArray(response) && response.length > 0) {
        const mapped = response.map(mapBackendInstrumentTypeToFrontend);
        setStoredData(TYPES_KEY, mapped);
        return mapped;
      }
    } catch (err: any) {
      // If backend returns 501 / 404 / 500 while stage is in progress, use standard reference types
      console.warn('Backend /instruments/types not ready or returned error, using standard reference master:', err?.message);
    }
    return getStoredData<InstrumentType[]>(TYPES_KEY, INITIAL_INSTRUMENT_TYPES);
  },

  /**
   * List instruments with optional filtering by owner, status, or search query
   * Calls GET /api/instruments
   */
  async listInstruments(params?: {
    ownerId?: string;
    status?: InstrumentStatus;
    search?: string;
    typeId?: string;
  }): Promise<Instrument[]> {
    try {
      const query = new URLSearchParams();
      if (params?.ownerId) query.append('ownerId', params.ownerId);
      if (params?.status) query.append('status', params.status);
      if (params?.typeId) query.append('typeId', params.typeId);
      if (params?.search) query.append('search', params.search);

      const qs = query.toString() ? `?${query.toString()}` : '';
      const response = await apiClient.get<BackendInstrumentResponse[]>(`/instruments${qs}`);

      if (Array.isArray(response)) {
        const mapped = response.map(mapBackendInstrumentToFrontend);
        setStoredData(INSTRUMENTS_KEY, mapped);
        return mapped;
      }
    } catch (err: any) {
      console.warn('Backend GET /api/instruments returned error, falling back to local dataset:', err?.message);
    }

    // Fallback to local dataset
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
   * Get single instrument by ID from backend GET /api/instruments/:id
   */
  async getInstrumentById(id: string): Promise<Instrument | null> {
    try {
      const response = await apiClient.get<BackendInstrumentResponse>(`/instruments/${id}`);
      if (response && response.id) {
        return mapBackendInstrumentToFrontend(response);
      }
    } catch (err: any) {
      console.warn(`Backend GET /api/instruments/${id} returned error, falling back:`, err?.message);
    }

    const list = getStoredData<Instrument[]>(INSTRUMENTS_KEY, INITIAL_INSTRUMENTS);
    return list.find((i) => i.id === id) || null;
  },

  /**
   * Register a new instrument via backend POST /api/instruments
   */
  async createInstrument(payload: CreateInstrumentPayload): Promise<Instrument> {
    const backendBody = mapFrontendCreateDtoToBackend(payload);
    try {
      const response = await apiClient.post<BackendInstrumentResponse>('/instruments', backendBody);
      if (response && response.id) {
        const created = mapBackendInstrumentToFrontend(response);
        const list = getStoredData<Instrument[]>(INSTRUMENTS_KEY, INITIAL_INSTRUMENTS);
        setStoredData(INSTRUMENTS_KEY, [created, ...list]);
        return created;
      }
    } catch (err: any) {
      console.warn('Backend POST /api/instruments returned error, saving locally:', err?.message);
    }

    // Local fallback creation
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
      location_lat: payload.location_lat || 19.076,
      location_lng: payload.location_lng || 72.998,
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
   * Update instrument status or details via backend PATCH /api/instruments/:id
   */
  async updateInstrument(id: string, updates: Partial<Instrument>): Promise<Instrument> {
    try {
      const response = await apiClient.patch<BackendInstrumentResponse>(`/instruments/${id}`, updates);
      if (response && response.id) {
        return mapBackendInstrumentToFrontend(response);
      }
    } catch (err: any) {
      console.warn(`Backend PATCH /api/instruments/${id} returned error, applying locally:`, err?.message);
    }

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
