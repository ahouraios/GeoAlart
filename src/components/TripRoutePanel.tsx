import React from 'react';
import { ActiveRoute, Destination } from '../types';
import { formatDistance, toPersianDigits } from '../utils/geo';
import { formatDuration } from '../utils/routing';
import { soundEngine } from '../utils/audio';

interface TripRoutePanelProps {
  activeRoute: ActiveRoute | null;
  destinations: Destination[];
  onAddStopToTrip: (dest: Destination) => void;
  onRemoveStopFromTrip: (index: number) => void;
  onMoveStop: (fromIndex: number, toIndex: number) => void;
  onClearTrip: () => void;
  onFitRouteBounds: () => void;
  isAutoFollowing: boolean;
  onToggleAutoFollow: () => void;
  onAdvanceStop?: () => void;
  onLaunchPresetTrip?: (type: 'home-work-mom') => void;
}

export const TripRoutePanel: React.FC<TripRoutePanelProps> = ({
  activeRoute,
  destinations,
  onAddStopToTrip,
  onRemoveStopFromTrip,
  onMoveStop,
  onClearTrip,
  onFitRouteBounds,
  isAutoFollowing,
  onToggleAutoFollow,
  onAdvanceStop,
  onLaunchPresetTrip,
}) => {
  const [isAddingStopOpen, setIsAddingStopOpen] = React.useState(false);

  // If no active route, show a sleek floating quick-launcher for multi-stop journeys
  if (!activeRoute) {
    return (
      <div className="absolute top-16 left-3 sm:left-4 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => onLaunchPresetTrip?.('home-work-mom')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200 shadow-lg backdrop-blur-md text-xs font-bold transition active:scale-95 group"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <span>شروع سفر ترتیبی: خانه ➔ محل کار ➔ خانه مامان</span>
          <svg className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    );
  }

  // Unselected destinations that can be added to trip
  const existingStopIds = new Set(activeRoute.stops.map((s) => s.id));
  const availableDestinations = destinations.filter((d) => !existingStopIds.has(d.id));

  const isMultiStop = activeRoute.stops.length > 1;
  const currentStop = activeRoute.stops[activeRoute.activeStopIndex];

  const handleVoiceAnnounce = () => {
    if (!currentStop) return;
    const msg = `شما در مسیر سفر هستید. هدف فعلی: ${currentStop.name}. با رسیدن به شعاع ۲۰ متر، اعلام ورود انجام می‌شود.`;
    soundEngine.speakPersian(msg);
  };

  return (
    <div
      className="absolute top-16 left-3 right-3 sm:right-auto sm:left-4 sm:w-96 z-25 bg-white/95 border border-slate-200/90 rounded-2xl shadow-xl backdrop-blur-md p-3.5 text-slate-800 transition-all animate-fade-in"
      dir="rtl"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 leading-tight">
              {isMultiStop ? 'سفر چند مقصده ترتیبی' : 'مسیریابی به سمت مقصد'}
            </h3>
            <p className="text-[10px] text-slate-500">
              دقت اعلام ورود: ۲۰ متر • هدایت مرحله به مرحله
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Voice Prompt Button */}
          <button
            type="button"
            onClick={handleVoiceAnnounce}
            title="اعلام صوتی راهنما با سخنگوی فارسی"
            className="p-1 rounded-lg hover:bg-blue-50 text-blue-600 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>

          {/* Close Route */}
          <button
            type="button"
            onClick={onClearTrip}
            title="بستن مسیریابی"
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Summary Banner */}
      <div className="grid grid-cols-2 gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/80 rounded-xl p-2.5 mb-2.5 text-center">
        <div>
          <span className="text-[10px] text-slate-500 block">مسافت کل مسیر</span>
          <strong className="text-sm font-black text-blue-700">
            {formatDistance(activeRoute.distanceMeters)}
          </strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block">زمان تخمینی حرکت</span>
          <strong className="text-sm font-black text-indigo-700">
            {formatDuration(activeRoute.durationSeconds)}
          </strong>
        </div>
      </div>

      {/* Ordered Stops List */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 mb-2.5">
        {/* Origin: User's Live Location */}
        <div className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping flex-shrink-0"></span>
          <span className="font-bold text-slate-700 truncate">مبدأ: موقعیت زنده شما</span>
        </div>

        {/* Ordered Destination Stops */}
        {activeRoute.stops.map((stop, index) => {
          const isTarget = index === activeRoute.activeStopIndex;
          const isPast = index < activeRoute.activeStopIndex;
          const stopNumber = toPersianDigits(index + 1);

          return (
            <div
              key={stop.id}
              className={`flex items-center justify-between gap-1.5 p-1.5 rounded-xl border text-xs transition ${
                isTarget
                  ? 'bg-blue-50/90 border-blue-400 ring-1 ring-blue-400/40 shadow-xs'
                  : isPast
                  ? 'bg-emerald-50/60 border-emerald-200 opacity-80'
                  : 'bg-white border-slate-200/80'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-2xs"
                  style={{ backgroundColor: isPast ? '#10b981' : stop.color || '#2563eb' }}
                >
                  {isPast ? '✓' : stopNumber}
                </span>
                <span className={`font-bold truncate ${isPast ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                  {stop.name}
                </span>
                {isTarget && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold whitespace-nowrap animate-pulse">
                    هدف فعلی
                  </span>
                )}
                {isPast && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold whitespace-nowrap">
                    رسیدید
                  </span>
                )}
              </div>

              {/* Stop Actions (Reorder / Remove) */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Move Up */}
                {index > 0 && !isPast && (
                  <button
                    type="button"
                    onClick={() => onMoveStop(index, index - 1)}
                    title="انتقال به بالا"
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                )}
                {/* Move Down */}
                {index < activeRoute.stops.length - 1 && !isPast && (
                  <button
                    type="button"
                    onClick={() => onMoveStop(index, index + 1)}
                    title="انتقال به پایین"
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
                {/* Remove Stop */}
                <button
                  type="button"
                  onClick={() => onRemoveStopFromTrip(index)}
                  title="حذف از این سفر"
                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Advance stop early (Manual button) */}
      {isMultiStop && activeRoute.activeStopIndex < activeRoute.stops.length - 1 && (
        <button
          type="button"
          onClick={onAdvanceStop}
          className="w-full py-1.5 px-2 mb-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 shadow-xs"
        >
          <span>تکمیل مرحله فعلی و رفتن به مقصد بعدی ➔</span>
        </button>
      )}

      {/* Add Another Destination Picker */}
      {isAddingStopOpen ? (
        <div className="mb-2.5 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-slate-700 text-[11px]">انتخاب مقصد برای افزودن:</span>
            <button
              type="button"
              onClick={() => setIsAddingStopOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-[10px]"
            >
              انصراف
            </button>
          </div>
          {availableDestinations.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-2">همه مقاصد ذخیره‌شده به این سفر اضافه شده‌اند.</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {availableDestinations.map((dest) => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => {
                    onAddStopToTrip(dest);
                    setIsAddingStopOpen(false);
                  }}
                  className="w-full text-right p-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center justify-between text-xs transition"
                >
                  <span className="font-semibold text-slate-800">{dest.name}</span>
                  <span className="text-blue-600 font-bold">+ افزودن</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAddingStopOpen(true)}
          className="w-full py-1.5 px-2 mb-2.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>+ افزودن مقصد دیگر به این سفر</span>
        </button>
      )}

      {/* Control Buttons (Fit Bounds, Follow, Clear) */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={onFitRouteBounds}
          title="نمایش تمام مسیر روی نقشه"
          className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span>نمایش کل مسیر</span>
        </button>

        <button
          type="button"
          onClick={onToggleAutoFollow}
          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
            isAutoFollowing
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isAutoFollowing ? 'bg-cyan-300 animate-ping' : 'bg-slate-400'}`}></span>
          <span>{isAutoFollowing ? 'هدایت زنده' : 'دنبال کردن'}</span>
        </button>
      </div>
    </div>
  );
};
