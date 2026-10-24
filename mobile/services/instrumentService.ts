import { apiRequest } from './api';

import {
  Instrument,
  InstrumentType,
  CreateInstrumentData,
} from '../types/instrument';

export async function getInstrumentTypes(): Promise<InstrumentType[]> {
  const response = await apiRequest('/instrument-types', {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}

export async function getInstruments(): Promise<Instrument[]> {
  const response = await apiRequest('/instruments', {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}

export async function getInstrumentById(
  id: string
): Promise<Instrument> {
  const response = await apiRequest(`/instruments/${id}`, {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}

export async function createInstrument(
  data: CreateInstrumentData
): Promise<Instrument> {
  const response = await apiRequest('/instruments', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });

  return response.data;
}