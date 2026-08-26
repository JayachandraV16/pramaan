import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { instrumentsApi } from '../../api/instruments.api';
import { InstrumentType } from '../../types';
import { Button } from '../../components/common/Button';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { useAuth } from '../../context/AuthContext';

export const NewInstrumentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [types, setTypes] = useState<InstrumentType[]>([]);
  const [instrumentName, setInstrumentName] = useState('');
  const [instrumentTypeId, setInstrumentTypeId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [capacityUnit, setCapacityUnit] = useState('kg');
  const [accuracyClass, setAccuracyClass] = useState('Class III (Medium Accuracy)');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState('19.0760');
  const [locationLng, setLocationLng] = useState('72.9980');

  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTypes() {
      try {
        const data = await instrumentsApi.getInstrumentTypes();
        setTypes(data);
        if (data.length > 0) {
          setInstrumentTypeId(data[0].id);
          setCapacityUnit(data[0].default_unit || 'kg');
        }
      } catch (err: any) {
        setError('Failed to load instrument types.');
      } finally {
        setIsLoadingTypes(false);
      }
    }
    loadTypes();
  }, []);

  const handleTypeChange = (typeId: string) => {
    setInstrumentTypeId(typeId);
    const matched = types.find((t) => t.id === typeId);
    if (matched && matched.default_unit) {
      setCapacityUnit(matched.default_unit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrumentName.trim() || !serialNumber.trim() || !capacity || !locationAddress.trim()) {
      setError('Please fill in all mandatory fields.');
      return;
    }
    if (Number(capacity) <= 0) {
      setError('Capacity must be a positive number.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await instrumentsApi.createInstrument({
        instrument_type_id: instrumentTypeId,
        instrument_name: instrumentName,
        manufacturer,
        model,
        serial_number: serialNumber,
        capacity: Number(capacity),
        capacity_unit: capacityUnit,
        accuracy_class: accuracyClass,
        location_address: locationAddress,
        location_lat: locationLat ? Number(locationLat) : undefined,
        location_lng: locationLng ? Number(locationLng) : undefined,
        owner_id: user?.id || 'u-101-owner-001',
        owner_name: user?.full_name || 'Rajesh Sharma',
      });
      navigate(`/instruments/${created.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to register instrument.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/instruments" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          ← Cancel & Back to Instruments
        </Link>
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
          Form 1: Statutory Registration
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-gov space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Register Weighing / Measuring Instrument</h1>
          <p className="text-xs text-slate-500 mt-1">
            Declare new weighing equipment for commercial, industrial, or retail use under the Legal Metrology Act, 2009.
          </p>
        </div>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category & Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instrument Classification Category *
            </label>
            <select
              value={instrumentTypeId}
              onChange={(e) => handleTypeChange(e.target.value)}
              disabled={isLoadingTypes}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 focus:bg-white"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Instrument Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instrument Identifier / Custom Name *
            </label>
            <input
              type="text"
              value={instrumentName}
              onChange={(e) => setInstrumentName(e.target.value)}
              placeholder="e.g. Weighbridge Gate 2, Retail Counter Scale #1"
              required
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
          </div>

          {/* Manufacturer & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manufacturer / Brand (OEM) *
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. Avery India, Essae, Mettler Toledo"
                required
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Model Number / Series
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. DS-215, AV-6000"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>
          </div>

          {/* Serial Number (Unique) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              OEM Factory Serial Number (Stamped on Metal Plaque) *
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. SN-AV-2026-99104"
              required
              className="w-full px-3.5 py-2 font-mono text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
            <p className="text-[11px] text-slate-400 mt-1">Must match the indelible metal nameplate on the physical device.</p>
          </div>

          {/* Capacity, Unit & Accuracy Class */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Measurable Capacity *
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 500"
                required
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Measurement Unit *
              </label>
              <select
                value={capacityUnit}
                onChange={(e) => setCapacityUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 focus:bg-white"
              >
                <option value="kg">kg (Kilograms)</option>
                <option value="g">g (Grams)</option>
                <option value="mg">mg (Milligrams)</option>
                <option value="tonne">tonne (Metric Tonnes)</option>
                <option value="litre">litre (Liquid Volume)</option>
                <option value="ml">ml (Millilitres)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Accuracy Class *
              </label>
              <select
                value={accuracyClass}
                onChange={(e) => setAccuracyClass(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 focus:bg-white"
              >
                <option value="Class I (Special Accuracy)">Class I (Special Accuracy - Lab)</option>
                <option value="Class II (High Accuracy)">Class II (High Accuracy - Bullion)</option>
                <option value="Class III (Medium Accuracy)">Class III (Medium Accuracy - Commercial)</option>
                <option value="Class IV (Ordinary Accuracy)">Class IV (Ordinary Accuracy)</option>
                <option value="Class 0.5 (Commercial Fuel Accuracy)">Class 0.5 (Commercial Fuel Dispenser)</option>
              </select>
            </div>
          </div>

          {/* Operating Location Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Location & Operating Premise Address *
            </label>
            <textarea
              rows={2}
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="Shop/Shed/Warehouse No., Mandi Yard/Road, City, District, PIN Code"
              required
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 resize-none"
            />
          </div>

          {/* GPS Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude (° N)</label>
              <input
                type="number"
                step="0.0001"
                value={locationLat}
                onChange={(e) => setLocationLat(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude (° E)</label>
              <input
                type="number"
                step="0.0001"
                value={locationLng}
                onChange={(e) => setLocationLng(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link to="/instruments">
              <Button type="button" variant="ghost" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="accent"
              size="md"
              isLoading={isSubmitting}
            >
              Submit Registration & Issue Reg No.
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
