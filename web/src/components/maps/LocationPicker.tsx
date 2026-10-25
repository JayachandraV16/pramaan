import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_VIEW, LatLng, formatCoordinate, isInIndia, round6, validateLatLngText } from '../../utils/coordinates';

const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// A CSS pin, so no marker image files have to be bundled.
const pinIcon = L.divIcon({
  className: 'pramaan-pin',
  html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#1a3a5c;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);transform:rotate(-45deg)"></div>',
  iconSize: [26, 26],
  iconAnchor: [4, 26],
});

interface Props {
  /** The chosen location, or null for none. */
  value: LatLng | null;
  /**
   * Called when the location changes. `error` is set while the typed coordinates are invalid
   * (value is then null): the parent should block saving.
   */
  onChange?: (value: LatLng | null, error: string | null) => void;
  readOnly?: boolean;
  height?: number;
  label?: string;
}

/** Interactive OpenStreetMap picker: click or drag the pin, use the device location, or type coordinates. */
export const LocationPicker: React.FC<Props> = ({ value, onChange, readOnly = false, height = 280, label }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [latText, setLatText] = useState(value ? formatCoordinate(value.lat) : '');
  const [lngText, setLngText] = useState(value ? formatCoordinate(value.lng) : '');
  const [error, setError] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);

  // Put the pin somewhere (from a click, a drag, the device location or typed numbers).
  const placePin = useCallback((p: LatLng, { pan = false, zoom }: { pan?: boolean; zoom?: number } = {}) => {
    const point = { lat: round6(p.lat), lng: round6(p.lng) };
    const map = mapRef.current;
    if (map) {
      if (!markerRef.current) {
        const marker = L.marker([point.lat, point.lng], { draggable: true, icon: pinIcon, keyboard: true, title: 'Instrument location' }).addTo(map);
        marker.on('dragend', () => {
          const ll = marker.getLatLng();
          applyPoint({ lat: ll.lat, lng: ll.lng });
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng([point.lat, point.lng]);
      }
      if (pan) map.setView([point.lat, point.lng], zoom ?? Math.max(map.getZoom(), 15));
    }
    return point;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A point chosen on the map or by the device: update the fields and tell the parent.
  const applyPoint = useCallback(
    (p: LatLng, opts?: { pan?: boolean; zoom?: number }) => {
      const point = placePin(p, opts);
      setLatText(formatCoordinate(point.lat));
      setLngText(formatCoordinate(point.lng));
      setError(null);
      onChangeRef.current?.(point, null);
    },
    [placePin]
  );

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [DEFAULT_VIEW.center.lat, DEFAULT_VIEW.center.lng],
      zoom: DEFAULT_VIEW.zoom,
      scrollWheelZoom: false, // do not hijack page scrolling
    });
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION });
    let errors = 0;
    tiles.on('tileerror', () => {
      errors += 1;
      if (errors >= 3) setTilesFailed(true);
    });
    tiles.on('tileload', () => {
      errors = 0;
      setTilesFailed(false);
    });
    tiles.addTo(map);
    mapRef.current = map;

    if (!readOnly) map.on('click', (e: L.LeafletMouseEvent) => applyPoint({ lat: e.latlng.lat, lng: e.latlng.lng }, { pan: true }));

    if (value) {
      placePin(value, { pan: true, zoom: 15 });
      markerRef.current?.dragging?.[readOnly ? 'disable' : 'enable']();
    }
    // The container may have been laid out after creation (tabs, modals): recompute its size.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The parent changed the value (for example after loading): move the pin and refresh the fields.
  useEffect(() => {
    if (!mapRef.current) return;
    if (value) {
      const current = markerRef.current?.getLatLng();
      if (!current || Math.abs(current.lat - value.lat) > 1e-7 || Math.abs(current.lng - value.lng) > 1e-7) {
        placePin(value, { pan: true, zoom: 15 });
        if (readOnly) markerRef.current?.dragging?.disable();
      }
      // Do not rewrite the boxes while the person is typing (it would reformat "18.5" to "18.500000"
      // under their cursor): only refresh them when they no longer describe this value.
      const sameAsText = Number(latText) === round6(value.lat) && Number(lngText) === round6(value.lng);
      if (!sameAsText) {
        setLatText(formatCoordinate(value.lat));
        setLngText(formatCoordinate(value.lng));
      }
    } else if (markerRef.current && !error) {
      markerRef.current.remove();
      markerRef.current = null;
      setLatText('');
      setLngText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  const onType = (nextLat: string, nextLng: string) => {
    setLatText(nextLat);
    setLngText(nextLng);
    const result = validateLatLngText(nextLat, nextLng);
    setError(result.error);
    if (result.value) {
      placePin(result.value, { pan: true });
      onChangeRef.current?.(result.value, null);
    } else {
      if (!result.error && markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      onChangeRef.current?.(null, result.error);
    }
  };

  const useMyLocation = () => {
    setLocateMessage(null);
    if (!('geolocation' in navigator)) return setLocateMessage('This browser cannot provide your location. Click the map instead.');
    if (!window.isSecureContext) return setLocateMessage('Your location is only available on a secure (HTTPS) page. Click the map instead.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        applyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { pan: true, zoom: 17 });
      },
      (err) => {
        setLocating(false);
        setLocateMessage(
          err.code === 1 ? 'Location permission was denied. Click the map instead.' : err.code === 3 ? 'Finding your location took too long. Try again or click the map.' : 'Your location is not available. Click the map instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const clear = () => {
    setLatText('');
    setLngText('');
    setError(null);
    markerRef.current?.remove();
    markerRef.current = null;
    onChangeRef.current?.(null, null);
  };

  const outside = value && !isInIndia(value);

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-slate-700">{label}</p>}
      <div
        ref={containerRef}
        role="application"
        aria-label={readOnly ? 'Map showing the instrument location' : 'Map: click to place the instrument location, drag the pin to adjust'}
        data-testid="location-map"
        style={{ height, width: '100%' }}
        className="rounded-xl border border-slate-300 overflow-hidden z-0"
      />
      {tilesFailed && (
        <p role="status" className="text-xs rounded-lg bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2">
          The map pictures could not be loaded (no internet?). You can still type the coordinates{readOnly ? '' : ' or use your location'}.
        </p>
      )}
      {!readOnly && (
        <>
          <p className="text-[11px] text-slate-500">Click the map to place the pin, then drag it to fine-tune. The coordinates fill in automatically.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Latitude (° N)
              <input
                inputMode="decimal"
                value={latText}
                onChange={(e) => onType(e.target.value, lngText)}
                aria-invalid={!!error}
                data-testid="lat-input"
                className="mt-1 w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Longitude (° E)
              <input
                inputMode="decimal"
                value={lngText}
                onChange={(e) => onType(latText, e.target.value)}
                aria-invalid={!!error}
                data-testid="lng-input"
                className="mt-1 w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={useMyLocation} disabled={locating} className="text-xs font-semibold rounded-lg border border-[#1a3a5c] text-[#1a3a5c] px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
              {locating ? 'Finding your location…' : 'Use my current location'}
            </button>
            <button type="button" onClick={clear} disabled={!value && !latText && !lngText} className="text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">
              Clear location
            </button>
            {!value && !error && <span className="text-xs text-slate-500">No location chosen: nothing will be saved.</span>}
          </div>
          {locateMessage && <p role="status" className="text-xs text-amber-800">{locateMessage}</p>}
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        </>
      )}
      {outside && <p role="status" className="text-xs text-amber-800">This point is outside India. Please check that it is correct.</p>}
    </div>
  );
};
