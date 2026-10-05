import React, { useState, useEffect } from 'react';
import { Destination } from '../types';
import { formatDistance, searchNominatim, toPersianDigits } from '../utils/geo';

interface AddDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dest: Omit<Destination, 'id' | 'createdAt'> & { id?: string }) => void;
  editingDestination: Destination | null;
  initialCoords: { lat: number; lon: number } | null;
}

const COLOR_OPTIONS = [
  { hex: '#2563eb', label: 'آبی' },
  { hex: '#ec4899', label: 'صورتی' },
  { hex: '#059669', label: 'سبز' },
  { hex: '#7c3aed', label: 'بنفش' },
  { hex: '#d97706', label: 'نارنجی' },
  { hex: '#dc2626', label: 'قرمز' },
];

const PRESET_WARNING_RADII = [100, 200, 300, 500, 1000];
const PRESET_ARRIVAL_RADII = [10, 15, 20, 30, 50];

const FAVORITE_PRESETS = [
  { name: 'خانه 🏠', category: 'home' as const, color: '#0284c7', desc: 'محل زندگی و استراحت' },
  { name: 'محل کار 🏢', category: 'work' as const, color: '#2563eb', desc: 'محل کار و دفتر' },
  { name: 'خانه مامان 🏡❤️', category: 'personal' as const, color: '#ec4899', desc: 'منزل مادری و خانواده' },
  { name: 'فروشگاه 🛒', category: 'shopping' as const, color: '#10b981', desc: 'مرکز خرید و مایحتاج' },
  { name: 'باشگاه 🏋️', category: 'personal' as const, color: '#f59e0b', desc: 'ورزش و تندرستی' },
];

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
  const [radiusMeters, setRadiusMeters] = useState(250);
  const [arrivalRadiusMeters, setArrivalRadiusMeters] = useState(20); // 20m high accuracy default
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
      setArrivalRadiusMeters(editingDestination.arrivalRadiusMeters || 20);
      setColor(editingDestination.color);
      setCategory(editingDestination.category);
    } else if (initialCoords) {
      setName('');
      setDescription('');
      setLat(Number(initialCoords.lat.toFixed(6)));
      setLon(Number(initialCoords.lon.toFixed(6)));
      setRadiusMeters(250);
      setArrivalRadiusMeters(20);
      setColor('#2563eb');
      setCategory('personal');
    }
    setSearchResults([]);
    setSearchQuery('');
    setSearchError(null);
  }, [editingDestination, initialCoords, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof FAVORITE_PRESETS[0]) => {
    setName(preset.name);
    setCategory(preset.category);
    setColor(preset.color);
    if (!description) {
      setDescription(preset.desc);
    }
  };

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchNominatim(searchQuery);
      if (results.length === 0) {
        setSearchError('مکانی با این عنوان یافت نشد. عبارت دیگری مانند نام خیابان یا میدان را امتحان کنید.');
      }
      setSearchResults(results);
    } catch {
      setSearchError('خطا در ارتباط با سرور نقشه.');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl text-slate-900 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full shadow-xs"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-base font-bold text-slate-900">
              {editingDestination ? 'ویرایش مقصد و محدوده هشدار' : 'ثبت مکان و مقصد جدید'}
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
          {/* Quick Preset Buttons for Favorite Places */}
          {!editingDestination && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                مکان‌های منتخب پرکاربرد (لمس برای انتخاب سریع):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FAVORITE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-800 transition active:scale-95 flex items-center gap-1"
                  >
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Search via Nominatim */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              جستجوی مکان یا آدرس روی نقشه (اختیاری)
            </label>
            <div className="flex gap-2">
              <input
                id="input-address-search"
                type="text"
                placeholder="مثال: ونک، برج میلاد، آزادی، تجریش..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAddress();
                  }
                }}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleSearchAddress}
                disabled={isSearching}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition"
              >
                {isSearching ? 'در حال جستجو...' : 'بیاب'}
              </button>
            </div>

            {searchError && (
              <p className="text-xs text-rose-600 font-medium">{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pt-2 border-t border-slate-200">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-right p-2 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 text-xs text-slate-800 transition block truncate"
                  >
                    <span className="font-bold text-blue-700 block">{res.name}</span>
                    <span className="text-[11px] text-slate-500 truncate block">{res.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Place Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عنوان مکان <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-dest-name"
              type="text"
              required
              placeholder="مثال: خانه، محل کار، خانه مامان، فروشگاه..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Place Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات یا یادداشت (اختیاری)
            </label>
            <textarea
              id="input-dest-desc"
              rows={2}
              placeholder="یادداشت همراه هشدار..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition resize-none"
            />
          </div>

          {/* Coordinates Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">عرض جغرافیایی (Lat)</label>
              <input
                id="input-dest-lat"
                type="number"
                step="any"
                required
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">طول جغرافیایی (Lon)</label>
              <input
                id="input-dest-lon"
                type="number"
                step="any"
                required
                value={lon}
                onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Warning Radius Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">شعاع هشدار نزدیکی (متر)</label>
              <span className="text-xs font-bold text-blue-600">{formatDistance(radiusMeters)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_WARNING_RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusMeters(r)}
                  className={`px-3 py-1 text-xs rounded-xl border transition ${
                    radiusMeters === r
                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {toPersianDigits(r)}م
                </button>
              ))}
            </div>
            <input
              type="range"
              min={50}
              max={1500}
              step={25}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Arrival Radius Selection (Requested: 20m or less) */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-emerald-900">
                دقت اعلام رسیدن کامل (Arrival Radius):
              </label>
              <span className="text-xs font-black text-emerald-700">
                {toPersianDigits(arrivalRadiusMeters)} متر
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 mb-2">
              هنگامی که فاصله شما کمتر از این شعاع شود، زنگ و اعلان ورود قطعی اعلام می‌گردد.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ARRIVAL_RADII.map((ar) => (
                <button
                  key={ar}
                  type="button"
                  onClick={() => setArrivalRadiusMeters(ar)}
                  className={`px-3 py-1 text-xs rounded-xl border transition ${
                    arrivalRadiusMeters === ar
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  {toPersianDigits(ar)} متر {ar === 20 ? '⭐ (پیش‌فرض دقیق)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">رنگ نشانگر و دایره محدوده</label>
            <div className="flex items-center gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c.hex ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition active:scale-95"
            >
              {editingDestination ? 'ذخیره تغییرات' : 'ثبت مکان'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
