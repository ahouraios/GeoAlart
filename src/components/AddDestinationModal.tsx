import React, { useState, useEffect } from 'react';
import { Destination } from '../types';
import { formatDistance, searchNominatim } from '../utils/geo';

interface AddDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dest: Omit<Destination, 'id' | 'createdAt'> & { id?: string }) => void;
  editingDestination: Destination | null;
  initialCoords: { lat: number; lon: number } | null;
}

const COLOR_OPTIONS = [
  { hex: '#0284c7', label: 'آبی اقیانوسی' },
  { hex: '#2563eb', label: 'آبی لاجوردی' },
  { hex: '#7c3aed', label: 'بنفش' },
  { hex: '#059669', label: 'سبز زمردی' },
  { hex: '#d97706', label: 'کهربایی' },
  { hex: '#dc2626', label: 'قرمز مرجانی' },
];

const PRESET_RADII = [50, 100, 200, 300, 500, 1000];

export const AddDestinationModal: React.FC<AddDestinationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDestination,
  initialCoords,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(35.6997);
  const [lon, setLon] = useState(51.3380);
  const [radiusMeters, setRadiusMeters] = useState(300);
  const [arrivalRadiusMeters, setArrivalRadiusMeters] = useState(50);
  const [color, setColor] = useState('#2563eb');
  const [category, setCategory] = useState<Destination['category']>('personal');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; displayName: string; lat: number; lon: number }>>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (editingDestination) {
      setName(editingDestination.name);
      setDescription(editingDestination.description || '');
      setLat(editingDestination.latitude);
      setLon(editingDestination.longitude);
      setRadiusMeters(editingDestination.radiusMeters);
      setArrivalRadiusMeters(editingDestination.arrivalRadiusMeters || 50);
      setColor(editingDestination.color);
      setCategory(editingDestination.category);
    } else if (initialCoords) {
      setName('');
      setDescription('');
      setLat(Number(initialCoords.lat.toFixed(6)));
      setLon(Number(initialCoords.lon.toFixed(6)));
      setRadiusMeters(300);
      setArrivalRadiusMeters(50);
      setColor('#2563eb');
      setCategory('personal');
    }
    setSearchResults([]);
    setSearchQuery('');
    setSearchError(null);
  }, [editingDestination, initialCoords, isOpen]);

  if (!isOpen) return null;

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchNominatim(searchQuery);
      if (results.length === 0) {
        setSearchError('مکانی با این عنوان یافت نشد. لطفاً عبارت دیگری را جستجو کنید.');
      }
      setSearchResults(results);
    } catch {
      setSearchError('خطا در برقراری ارتباط با سرویس نقشه.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (res: { name: string; lat: number; lon: number }) => {
    setLat(Number(res.lat.toFixed(6)));
    setLon(Number(res.lon.toFixed(6)));
    if (!name) {
      setName(res.name);
    }
    setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: editingDestination ? editingDestination.id : undefined,
      name: name.trim(),
      description: description.trim() || undefined,
      latitude: lat,
      longitude: lon,
      radiusMeters,
      arrivalRadiusMeters,
      color,
      category,
      enabled: editingDestination ? editingDestination.enabled : true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl text-slate-900 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full shadow-xs"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-base font-bold text-slate-900">
              {editingDestination ? 'ویرایش مقصد و محدوده هشدار' : 'افزودن مقصد جدید'}
            </h3>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick Search via Nominatim */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              جستجوی مکان یا آدرس روی نقشه (اختیاری)
            </label>
            <div className="flex gap-2">
              <input
                id="input-address-search"
                type="text"
                placeholder="مثال: میدان ولیعصر، برج میلاد، پارک لاله..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAddress();
                  }
                }}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <button
                type="button"
                id="btn-perform-search"
                onClick={handleSearchAddress}
                disabled={isSearching}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-2xs"
              >
                {isSearching ? 'در حال جستجو...' : 'جستجو'}
              </button>
            </div>

            {searchError && (
              <p className="text-[11px] text-rose-600 font-medium">{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 text-xs shadow-md">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-right p-2.5 hover:bg-blue-50 transition block text-slate-800"
                  >
                    <div className="font-bold text-blue-600">{res.name}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{res.displayName}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نام مقصد <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-destination-name"
              type="text"
              required
              placeholder="مثلاً: خانه، شرکت، دانشگاه، بیمارستان"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات یا یادداشت (اختیاری)
            </label>
            <input
              id="input-destination-desc"
              type="text"
              placeholder="مثلاً: بردن کلید، تحویل بسته، خرید میوه"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>

          {/* Coordinates (Readonly or Editable) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">عرض جغرافیایی (Latitude)</label>
              <input
                type="number"
                step="any"
                required
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-left focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">طول جغرافیایی (Longitude)</label>
              <input
                type="number"
                step="any"
                required
                value={lon}
                onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-left focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Geofence Warning Radius Slider & Presets */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                شعاع هشدار نزدیکی (Geofence Radius)
              </label>
              <span className="text-xs font-bold text-blue-600 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200">
                {formatDistance(radiusMeters)}
              </span>
            </div>

            <input
              id="slider-radius"
              type="range"
              min="50"
              max="2000"
              step="50"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_RADII.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRadiusMeters(val)}
                  className={`px-3 py-1 text-xs rounded-lg transition font-medium border ${
                    radiusMeters === val
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {formatDistance(val)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              هنگامی که فاصله شما در حین حرکت به کمتر از این مقدار برسد، اعلان مرورگر، صدای هشدار و لرزش پخش خواهد شد.
            </p>
          </div>

          {/* Color & Theme Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              رنگ نشانگر و محدوده
            </label>
            <div className="flex items-center gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center shadow-xs ${
                    color === c.hex ? 'scale-115 ring-3 ring-blue-500/50 ring-offset-2' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
            <button
              id="btn-save-destination"
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition active:scale-98"
            >
              {editingDestination ? 'ذخیره تغییرات' : 'ثبت مقصد جدید'}
            </button>
            <button
              id="btn-cancel-destination"
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
