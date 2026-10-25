// Tile source shared by the map components (OpenStreetMap by default; override with VITE_MAP_TILE_URL / VITE_MAP_ATTRIBUTION).
export const DEFAULT_TILES = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATTRIBUTION =
  (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
