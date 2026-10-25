import React, { useEffect, useState } from 'react';
import { Instrument } from '../../types';
import { instrumentManageApi } from '../../api/workflow.api';
import { Button } from '../common/Button';
import { LocationPicker } from '../maps/LocationPicker';
import { LatLng } from '../../utils/coordinates';

interface Props {
  instrument: Instrument;
  canManage: boolean;
  onChanged: () => void;
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]';

/** Edit an instrument and take it out of service (owner of the instrument or administrator). */
export const InstrumentManage: React.FC<Props> = ({ instrument, canManage, onChanged }) => {
  const [form, setForm] = useState({ instrumentName: '', manufacturer: '', model: '', capacity: '', capacityUnit: '', accuracyClass: '', locationAddress: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    const lat = instrument.location_lat;
    const lng = instrument.location_lng;
    setLoc(lat !== undefined && lat !== null && lng !== undefined && lng !== null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null);
    setLocError(null);
    setForm({
      instrumentName: instrument.instrument_name || '',
      manufacturer: instrument.manufacturer || '',
      model: instrument.model || '',
      capacity: instrument.capacity ? String(instrument.capacity) : '',
      capacityUnit: instrument.capacity_unit || '',
      accuracyClass: instrument.accuracy_class || '',
      locationAddress: instrument.location_address && instrument.location_address !== '—' ? instrument.location_address : '',
    });
  }, [instrument]);

  if (!canManage) return null;
  const status = instrument.status as string;
  const decommissioned = status === 'DECOMMISSIONED';

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ kind: 'ok', text: okText });
      onChanged();
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Action failed.' });
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (locError) {
      setNotice({ kind: 'err', text: locError });
      return;
    }
    run(
      () =>
        instrumentManageApi.update(instrument.id, {
          instrumentName: form.instrumentName,
          manufacturer: form.manufacturer,
          model: form.model,
          capacity: form.capacity === '' ? null : Number(form.capacity),
          capacityUnit: form.capacityUnit,
          accuracyClass: form.accuracyClass,
          locationAddress: form.locationAddress,
          locationLat: loc ? loc.lat : null,
          locationLng: loc ? loc.lng : null,
        }),
      'Instrument details saved.'
    );
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-gov p-5 space-y-4" aria-label="Manage instrument">
      <h2 className="text-sm font-bold text-slate-900">Manage this instrument</h2>

      {decommissioned ? (
        <p className="text-sm text-slate-700">
          This instrument was decommissioned{instrument.status_reason ? ` (${instrument.status_reason})` : ''} and can no longer be changed or verified.
        </p>
      ) : (
        <>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Name
              <input required value={form.instrumentName} onChange={f('instrumentName')} className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Accuracy class
              <input value={form.accuracyClass} onChange={f('accuracyClass')} className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Manufacturer
              <input value={form.manufacturer} onChange={f('manufacturer')} className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Model
              <input value={form.model} onChange={f('model')} className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-700">Capacity
                <input type="number" min="0" step="any" value={form.capacity} onChange={f('capacity')} className={inputCls} />
              </label>
              <label className="text-xs font-semibold text-slate-700">Unit
                <input value={form.capacityUnit} onChange={f('capacityUnit')} className={inputCls} />
              </label>
            </div>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-3">Location
              <input value={form.locationAddress} onChange={f('locationAddress')} className={inputCls} />
            </label>
            <div className="sm:col-span-3">
              <LocationPicker
                label="Location on the map"
                value={loc}
                height={240}
                onChange={(value, err) => {
                  setLoc(value);
                  setLocError(err);
                }}
              />
            </div>
            <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" isLoading={busy}>Save changes</Button>
              <span className="text-xs text-slate-500">While an application is open only the name and location can change; the serial number and type are fixed once an application exists.</span>
            </div>
          </form>

          <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2">
            {(status === 'REGISTERED' || status === 'ACTIVE') && (
              <Button
                size="sm"
                variant="secondary"
                isLoading={busy}
                onClick={() => {
                  const reason = window.prompt('Why is this instrument going out of use? (optional)');
                  if (reason === null) return;
                  run(() => instrumentManageApi.deactivate(instrument.id, reason.trim() || undefined), 'Instrument marked inactive.');
                }}
              >
                Mark inactive
              </Button>
            )}
            {status === 'INACTIVE' && (
              <Button size="sm" variant="secondary" isLoading={busy} onClick={() => run(() => instrumentManageApi.reactivate(instrument.id), 'Instrument reactivated.')}>
                Reactivate
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              isLoading={busy}
              onClick={() => {
                const reason = window.prompt('Decommissioning is permanent. Why is this instrument being withdrawn? (at least 10 characters)');
                if (reason === null) return;
                if (!window.confirm('Decommission this instrument permanently? It can no longer be edited or verified.')) return;
                run(() => instrumentManageApi.decommission(instrument.id, reason.trim()), 'Instrument decommissioned.');
              }}
            >
              Decommission…
            </Button>
          </div>
        </>
      )}

      {notice && (
        <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`text-sm ${notice.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {notice.text}
        </p>
      )}
    </section>
  );
};
