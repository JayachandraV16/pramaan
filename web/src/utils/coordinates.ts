// Pure coordinate helpers for the location picker. No imports on purpose: the API test suite
// loads this file directly (Node strips the types) so the rules are tested without a browser.

export interface LatLng {
  lat: number;
  lng: number;
}

/** Rough bounding box of India including island territories; used only to warn, never to block. */
export const INDIA_BOUNDS = { south: 6.0, north: 37.5, west: 68.0, east: 97.5 };

/** Where the map opens when nothing is chosen yet. It is a view only and is never saved. */
export const DEFAULT_VIEW: { center: LatLng; zoom: number } = { center: { lat: 22.5, lng: 79.0 }, zoom: 4 };

/** The coordinates the registration form used to pre-fill for every instrument (central Mumbai). */
export const FORMER_DEFAULT: LatLng = { lat: 19.076, lng: 72.998 };

export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export const formatCoordinate = (n: number): string => round6(n).toFixed(6);

export function isInIndia(p: LatLng): boolean {
  return p.lat >= INDIA_BOUNDS.south && p.lat <= INDIA_BOUNDS.north && p.lng >= INDIA_BOUNDS.west && p.lng <= INDIA_BOUNDS.east;
}

/** True when a stored location is exactly the old invented default (so it is probably not real). */
export function isFormerDefault(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  return Math.abs(Number(lat) - FORMER_DEFAULT.lat) < 1e-4 && Math.abs(Number(lng) - FORMER_DEFAULT.lng) < 1e-4;
}

export interface PairResult {
  ok: boolean;
  value: LatLng | null;
  error: string | null;
}

/**
 * Validates what a person typed into the latitude and longitude boxes.
 *   both blank          -> ok, no location
 *   one blank           -> error (a location needs both)
 *   not a number / out of range -> error
 */
export function validateLatLngText(latText: string, lngText: string): PairResult {
  const latBlank = latText.trim() === '';
  const lngBlank = lngText.trim() === '';
  if (latBlank && lngBlank) return { ok: true, value: null, error: null };
  if (latBlank || lngBlank) return { ok: false, value: null, error: 'Enter both latitude and longitude, or clear both.' };

  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, value: null, error: 'Latitude and longitude must be numbers.' };
  if (lat < -90 || lat > 90) return { ok: false, value: null, error: 'Latitude must be between -90 and 90.' };
  if (lng < -180 || lng > 180) return { ok: false, value: null, error: 'Longitude must be between -180 and 180.' };
  return { ok: true, value: { lat: round6(lat), lng: round6(lng) }, error: null };
}
