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
} from './client';

export const INITIAL_INSTRUMENT_TYPES: InstrumentType[] = [
  {
    id: 'da5a9371-422d-4056-9359-ac0618451a0a',
    name: 'Weighing Scale',
    description: 'General-purpose mechanical or electronic weighing scale.',
    default_unit: 'kg',
    is_active: true,
    created_at: '2026-08-27T10:09:26.790Z',
  },
  {
    id: 'b27bf215-3ec1-4644-a67a-561784913635',
    name: 'Electronic Balance',
    description: 'Precision electronic balance used for small-mass measurement.',
    default_unit: 'g',
    is_active: true,
    created_at: '2026-08-27T10:09:26.790Z',
  },
  {
    id: 'e7c51ab8-44ca-48fd-b266-e72f0d49ee73',
    name: 'Platform Scale',
    description: 'Heavy-duty platform scale for industrial/commercial weighing.',
    default_unit: 'kg',
    is_active: true,
    created_at: '2026-08-27T10:09:26.790Z',
  },
  {
    id: 'f6613610-7e76-4f47-8241-6d8ad4fa4942',
    name: 'Weighbridge',
    description: 'Large-capacity vehicle weighbridge.',
    default_unit: 'kg',
    is_active: true,
    created_at: '2026-08-27T10:09:26.790Z',
  },
  {
    id: 'f450da3f-34c5-47e2-af17-d2deed32900d',
    name: 'Fuel Dispensing Unit',
    description: 'Petrol/diesel dispensing pump measuring instrument.',
    default_unit: 'litre',
    is_active: true,
    created_at: '2026-08-27T10:09:26.790Z',
  },
  {
    id: 'd62b482d-988b-4b32-b249-e462ba71cc89',
    name: 'Measuring Instrument',
    description: 'General liquid/length/volume measuring instrument.',
    default_unit: 'litre',
    is_active: true,
    created_at: '2026-08-27T10:09:26.790Z',
  },
];

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
  const typeId = item.instrumentTypeId || item.instrument_type_id || 'da5a9371-422d-4056-9359-ac0618451a0a';
  const typeName =
    item.instrumentTypeName ||
    item.instrument_type_name ||
    INITIAL_INSTRUMENT_TYPES.find((t) => t.id === typeId)?.name ||
    'General Metrology Instrument';

  const rawLat = item.locationLat ?? item.location_lat;
  const rawLng = item.locationLng ?? item.location_lng;
  const rawCap = item.capacity;

  return {
    id: item.id,
    owner_id: item.ownerId || item.owner_id || '',
    owner_name: item.ownerName || item.owner_name || 'Instrument Custodian',
    instrument_type_id: typeId,
    instrument_type_name: typeName,
    instrument_name: item.instrumentName || item.instrument_name || item.model || 'Weighing / Measuring Asset',
    manufacturer: item.manufacturer || 'OEM Manufacturer',
    model: item.model || 'Standard Series',
    serial_number: item.serialNumber || item.serial_number || `SN-${item.id}`,
    registration_number: item.registrationNumber ?? item.registration_number ?? null,
    capacity: rawCap !== null && rawCap !== undefined && rawCap !== '' ? Number(rawCap) : 0,
    capacity_unit: item.capacityUnit || item.capacity_unit || 'kg',
    accuracy_class: item.accuracyClass || item.accuracy_class || 'Class III (Medium Accuracy)',
    location_address: item.locationAddress || item.location_address || 'Operating Premises',
    location_lat: rawLat !== null && rawLat !== undefined && rawLat !== '' ? Number(rawLat) : undefined,
    location_lng: rawLng !== null && rawLng !== undefined && rawLng !== '' ? Number(rawLng) : undefined,
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
   * Get all instrument types matching PostgreSQL master instrument_types catalog
   */
  async getInstrumentTypes(): Promise<InstrumentType[]> {
    return INITIAL_INSTRUMENT_TYPES;
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
    const query = new URLSearchParams();
    if (params?.ownerId) query.append('ownerId', params.ownerId);
    if (params?.status) query.append('status', params.status);
    if (params?.typeId) query.append('typeId', params.typeId);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get<BackendInstrumentResponse[]>(`/instruments${qs}`);

    if (!Array.isArray(response)) {
      return [];
    }

    let list = response.map(mapBackendInstrumentToFrontend);

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
    const response = await apiClient.get<BackendInstrumentResponse>(`/instruments/${id}`);
    if (response && response.id) {
      return mapBackendInstrumentToFrontend(response);
    }
    return null;
  },

  /**
   * Register a new instrument via backend POST /api/instruments
   */
  async createInstrument(payload: CreateInstrumentPayload): Promise<Instrument> {
    const backendBody = mapFrontendCreateDtoToBackend(payload);
    const response = await apiClient.post<BackendInstrumentResponse>('/instruments', backendBody);
    if (!response || !response.id) {
      throw new Error('Failed to create instrument. Invalid response received from server.');
    }
    return mapBackendInstrumentToFrontend(response);
  },

  /**
   * Update instrument status or details via backend PATCH /api/instruments/:id
   */
  async updateInstrument(id: string, updates: Partial<Instrument>): Promise<Instrument> {
    const response = await apiClient.patch<BackendInstrumentResponse>(`/instruments/${id}`, updates);
    if (!response || !response.id) {
      throw new Error(`Failed to update instrument ${id}.`);
    }
    return mapBackendInstrumentToFrontend(response);
  },
};
