import React from 'react';
import { AlertNotificationItem } from '../types';
import { soundEngine } from '../utils/audio';

interface AlertBannerProps {
  alerts: AlertNotificationItem[];
  onDismiss: (id: string) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-14 left-4 right-4 z-40 max-w-md mx-auto space-y-2 pointer-events-auto">
      {alerts.map((alert) => {
        const isArrival = alert.type === 'arrival';

        return (
          <div
            key={alert.id}
            className={`p-3.5 rounded-2xl border shadow-xl backdrop-blur-xl transition-all duration-300 flex items-start justify-between gap-3 animate-bounce-short ${
              isArrival
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950 ring-2 ring-emerald-400/30'
                : 'bg-amber-50/95 border-amber-300 text-amber-950 ring-2 ring-amber-400/30'
            }`}
          >
            {/* Icon */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs ${
                isArrival ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {isArrival ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {isArrival ? 'رسیدن به مقصد! 🎯' : 'هشدار نزدیکی 🔔'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  ({new Date(alert.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })})
                </span>
              </div>
              <p className="text-xs font-semibold mt-0.5 leading-relaxed text-slate-800">{alert.message}</p>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isArrival) {
                      soundEngine.playArrivalChime();
                    } else {
                      soundEngine.playProximityChime();
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                    isArrival
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-200'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  <span>پخش مجدد آلارم</span>
                </button>
              </div>
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition flex-shrink-0"
              title="بستن"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};
