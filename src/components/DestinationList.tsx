import React, { useState } from 'react';
import { Destination, ActiveRoute } from '../types';
import { formatDistance, toPersianDigits } from '../utils/geo';
import { soundEngine } from '../utils/audio';

interface DestinationListProps {
  destinations: Destination[];
  distances: Record<string, number>;
  selectedDestination: Destination | null;
  activeRoute: ActiveRoute | null;
  onSelectDestination: (dest: Destination) => void;
  onRouteToDestination: (dest: Destination) => void;
  onAddDestinationToTrip: (dest: Destination) => void;
  onEditDestination: (dest: Destination) => void;
  onToggleDestination: (id: string) => void;
  onDeleteDestination: (id: string) => void;
  onOpenAddModal: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const DestinationList: React.FC<DestinationListProps> = ({
  destinations,
  distances,
  selectedDestination,
  activeRoute,
  onSelectDestination,
  onRouteToDestination,
  onAddDestinationToTrip,
  onEditDestination,
  onToggleDestination,
  onDeleteDestination,
  onOpenAddModal,
  isExpanded,
  onToggleExpand,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort destinations by distance (closest first)
  const sortedDestinations = [...destinations].sort((a, b) => {
    const distA = distances[a.id] ?? Infinity;
    const distB = distances[b.id] ?? Infinity;
    return distA - distB;
  });

  const filteredDestinations = sortedDestinations.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Identify closest destination
  const closestDestination = sortedDestinations[0];
  const closestDist = closestDestination ? distances[closestDestination.id] : undefined;

  const activeCount = destinations.filter((d) => d.enabled).length;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-20 bg-white/95 border-t border-slate-200/90 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-in-out flex flex-col text-slate-800 ${
        isExpanded ? 'h-[75vh] max-h-[580px]' : 'h-20 sm:h-22'
      }`}
    >
      {/* Top Handle / Collapsed Header */}
      <div
        onClick={onToggleExpand}
        className="w-full px-4 py-2.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition flex-shrink-0"
      >
        {/* Grab Handle Pill for mobile */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-300"></div>

        {/* Left/Start: Closest target info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">نزدیک‌ترین مقصد:</span>
              {closestDestination ? (
                <span className="text-xs font-bold text-slate-900">{closestDestination.name}</span>
              ) : (
                <span className="text-xs text-slate-400">مقصدی ثبت نشده</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {closestDist !== undefined ? (
                <span className="text-xs font-bold text-blue-600">
                  فاصله: {formatDistance(closestDist)}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">در حال دریافت سیگنال GPS</span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {toPersianDigits(activeCount)} از {toPersianDigits(destinations.length)} فعال
              </span>
            </div>
          </div>
        </div>

        {/* Right: Expand/Collapse Arrow & Quick Route Status */}
        <div className="flex items-center gap-2">
          {activeRoute && (
            <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>سفر فعال ({toPersianDigits(activeRoute.stops.length)} مقصد)</span>
            </div>
          )}

          <button
            id="btn-toggle-sheet"
            type="button"
            aria-label={isExpanded ? 'بستن پنل مقاصد' : 'باز کردن پنل مقاصد'}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
          >
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content View */}
      {isExpanded && (
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-4">
          {/* Controls Bar inside sheet */}
          <div className="flex items-center gap-2 py-2 flex-shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                id="input-search-destinations"
                type="text"
                placeholder="جستجو بین مقاصد ذخیره‌شده..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute right-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Add New Destination Button */}
            <button
              id="btn-add-dest-in-sheet"
              type="button"
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>افزودن مقصد</span>
            </button>
          </div>

          {/* Destination Cards List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 mt-1">
            {filteredDestinations.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                {destinations.length === 0 ? (
                  <div>
                    <p className="font-semibold text-slate-700 mb-1">هنوز مقصدی تعریف نشده است</p>
                    <p className="text-slate-500 mb-3">با لمس روی نقشه یا دکمه افزودن، اولین محدوده هشدار را بسازید.</p>
                    <button
                      type="button"
                      onClick={onOpenAddModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
                    >
                      افزودن اولین مقصد
                    </button>
                  </div>
                ) : (
                  <p>موردی با این عبارت یافت نشد.</p>
                )}
              </div>
            ) : (
              filteredDestinations.map((dest) => {
                const distance = distances[dest.id];
                const isInsideWarning = distance !== undefined && distance <= dest.radiusMeters;
                const isInsideArrival = distance !== undefined && distance <= dest.arrivalRadiusMeters;
                const isSelected = selectedDestination?.id === dest.id;

                // Check if this destination is part of the active route
                const tripStopIndex = activeRoute?.stops.findIndex((s) => s.id === dest.id) ?? -1;
                const isInTrip = tripStopIndex >= 0;

                return (
                  <div
                    key={dest.id}
                    id={`dest-card-${dest.id}`}
                    onClick={() => {
                      onSelectDestination(dest);
                      onRouteToDestination(dest);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 shadow-md ring-1 ring-blue-400/40'
                        : 'bg-slate-50/90 border-slate-200/80 hover:bg-slate-100/90 hover:border-slate-300'
                    } ${!dest.enabled ? 'opacity-65' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Category Indicator Dot or Trip Stop Badge */}
                        {isInTrip ? (
                          <span
                            className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5"
                            style={{ backgroundColor: dest.color }}
                          >
                            {toPersianDigits(tripStopIndex + 1)}
                          </span>
                        ) : (
                          <div
                            className="w-3.5 h-3.5 rounded-full mt-1 flex-shrink-0 shadow-xs"
                            style={{ backgroundColor: dest.color }}
                          />
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{dest.name}</h4>
                            {isInTrip && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold border border-blue-200">
                                توقف {toPersianDigits(tripStopIndex + 1)} در سفر
                              </span>
                            )}
                            {isInsideArrival && dest.enabled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 animate-pulse">
                                رسیدید! 🎯
                              </span>
                            )}
                            {isInsideWarning && !isInsideArrival && dest.enabled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-300 animate-pulse">
                                در محدوده هشدار 🔔
                              </span>
                            )}
                          </div>
                          {dest.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{dest.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Distance Badge & Toggle Switch */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="text-left">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                              isInsideArrival && dest.enabled
                                ? 'bg-emerald-600 text-white'
                                : isInsideWarning && dest.enabled
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {distance !== undefined ? formatDistance(distance) : '—'}
                          </span>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <button
                          type="button"
                          id={`toggle-dest-${dest.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleDestination(dest.id);
                          }}
                          title={dest.enabled ? 'غیرفعال کردن آلارم' : 'فعال کردن آلارم'}
                          aria-label={dest.enabled ? 'غیرفعال کردن آلارم' : 'فعال کردن آلارم'}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            dest.enabled ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              dest.enabled ? '-translate-x-4' : '-translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Geofence metadata and action buttons */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span>
                          هشدار: <strong className="text-slate-700">{formatDistance(dest.radiusMeters)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          رسیدن: <strong className="text-slate-700">{formatDistance(dest.arrivalRadiusMeters)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {/* Route to this Destination Button */}
                        <button
                          type="button"
                          onClick={() => {
                            onRouteToDestination(dest);
                          }}
                          title="ترسیم مسیر از مکان من به این نقطه"
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span>مسیریابی</span>
                        </button>

                        {/* Add to multi-destination trip button */}
                        {!isInTrip && (
                          <button
                            type="button"
                            onClick={() => onAddDestinationToTrip(dest)}
                            title="افزودن به سفر چند مقصده"
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition flex items-center gap-1 border border-indigo-200"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                            </svg>
                            <span>+ به سفر</span>
                          </button>
                        )}

                        {/* Test Alert Sound */}
                        <button
                          type="button"
                          onClick={() => soundEngine.playProximityChime()}
                          title="تست صدای زنگ هشدار"
                          className="px-2 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-200 text-slate-700 transition font-medium"
                        >
                          صدا
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          id={`btn-edit-${dest.id}`}
                          onClick={() => onEditDestination(dest)}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition font-semibold"
                        >
                          ویرایش
                        </button>

                        {/* Delete Button with inline confirmation */}
                        {deletingId === dest.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded-lg border border-rose-200">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteDestination(dest.id);
                                setDeletingId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]"
                            >
                              حذف قطعی
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="px-1.5 py-0.5 text-slate-600 text-[10px]"
                            >
                              انصراف
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-delete-${dest.id}`}
                            onClick={() => setDeletingId(dest.id)}
                            className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition font-semibold"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
