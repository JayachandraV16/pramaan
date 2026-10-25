import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HqMapData, MapState } from '../../api/hq.api';
import { ATTRIBUTION, DEFAULT_TILES } from './mapConfig';
import { DEFAULT_VIEW } from '../../utils/coordinates';

export const STATE_STYLE: Record<MapState, { label: string; color: string }> = {
  VALID: { label: 'Valid', color: '#15803d' },
  DUE_SOON: { label: 'Due within 30 days', color: '#d97706' },
  OVERDUE: { label: 'Overdue', color: '#dc2626' },
  REVOKED: { label: 'Certificate revoked', color: '#7f1d1d' },
  NEVER_VERIFIED: { label: 'Never verified', color: '#64748b' },
};

interface Props {
  data: HqMapData | null;
  height?: number;
  /** called when someone follows the link in a marker's popup */
  onOpen: (path: string) => void;
}

const line = (parent: HTMLElement, text: string, bold = false) => {
  const el = document.createElement(bold ? 'strong' : 'div');
  el.textContent = text; // data goes in as text, never as HTML
  parent.appendChild(el);
  return el;
};

/** Read-only map of every located instrument (colour = verification state) and open enforcement cases. */
export const HqMap: React.FC<Props> = ({ data, height = 420, onOpen }) => {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = L.map(container.current, { center: [DEFAULT_VIEW.center.lat, DEFAULT_VIEW.center.lng], zoom: DEFAULT_VIEW.zoom, scrollWheelZoom: false });
    const tiles = L.tileLayer(DEFAULT_TILES, { maxZoom: 19, attribution: ATTRIBUTION });
    let errors = 0;
    tiles.on('tileerror', () => {
      errors += 1;
      if (errors >= 3) setTilesFailed(true);
    });
    tiles.on('tileload', () => {
      errors = 0;
      setTilesFailed(false);
    });
    tiles.addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 0);
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group || !data) return;
    group.clearLayers();
    const points: L.LatLngExpression[] = [];

    for (const p of data.instruments) {
      const style = STATE_STYLE[p.state];
      const marker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: style.color, fillOpacity: 0.95 });
      const box = document.createElement('div');
      line(box, p.instrument_name, true);
      line(box, `Serial ${p.serial_number}`);
      line(box, `Owner: ${p.owner_name}`);
      line(box, `${style.label}${p.certificate_number ? ` · ${p.certificate_number}` : ''}`);
      if (p.next_due_date) line(box, `Next due: ${String(p.next_due_date).slice(0, 10)}`);
      const a = document.createElement('a');
      a.href = `/instruments/${p.id}`;
      a.textContent = 'Open instrument';
      a.style.color = '#1a3a5c';
      a.onclick = (e) => {
        e.preventDefault();
        openRef.current(`/instruments/${p.id}`);
      };
      box.appendChild(a);
      marker.bindPopup(box);
      marker.addTo(group);
      points.push([p.lat, p.lng]);
    }
    for (const c of data.cases) {
      const marker = L.circleMarker([c.lat, c.lng], { radius: 10, color: '#111827', weight: 3, fillColor: '#f97316', fillOpacity: 0.9, dashArray: '3 2' });
      const box = document.createElement('div');
      line(box, `Enforcement case ${c.case_number}`, true);
      line(box, `${c.offence_type.replace(/_/g, ' ').toLowerCase()} · ${c.status.replace(/_/g, ' ').toLowerCase()}`);
      line(box, `Detected ${String(c.detected_on).slice(0, 10)}`);
      const a = document.createElement('a');
      a.href = '/enforcement';
      a.textContent = 'Open enforcement';
      a.style.color = '#1a3a5c';
      a.onclick = (e) => {
        e.preventDefault();
        openRef.current('/enforcement');
      };
      box.appendChild(a);
      marker.bindPopup(box);
      marker.addTo(group);
      points.push([c.lat, c.lng]);
    }
    if (points.length > 0) m.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 14 });
    else m.setView([DEFAULT_VIEW.center.lat, DEFAULT_VIEW.center.lng], DEFAULT_VIEW.zoom);
  }, [data]);

  return (
    <>
    <div
      ref={container}
      role="application"
      aria-label="Map of instruments and open enforcement cases"
      data-testid="hq-map"
      data-points={data ? data.instruments.length + data.cases.length : 0}
      style={{ height, width: '100%' }}
      className="rounded-xl border border-slate-300 overflow-hidden z-0"
    />
    {tilesFailed && (
      <p role="status" className="mt-2 text-xs rounded-lg bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2">
        The map pictures could not be loaded (no internet?). The markers are still shown and can be opened.
      </p>
    )}
    </>
  );
};
