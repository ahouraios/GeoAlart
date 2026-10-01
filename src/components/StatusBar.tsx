import React from 'react';
import { GPSState, UserLocation } from '../types';
import { toPersianDigits } from '../utils/geo';
import { soundEngine } from '../utils/audio';

interface StatusBarProps {
  gpsState: GPSState;
  userLocation: UserLocation;
  locationSource?: 'gps' | 'network' | 'ip' | 'manual' | 'simulated';
  onRetryGps?: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
  onOpenInstallModal: () => void;
  isPwaInstallable: boolean;
  isPwaInstalled: boolean;
  onOpenAddModal: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  gpsState,
  userLocation,
  locationSource = 'gps',
  onRetryGps,
  isSimulating,
  onToggleSimulation,
  isMuted,
  onToggleMute,
  notificationPermission,
  onRequestNotificationPermission,
  onOpenInstallModal,
  isPwaInstallable,
  isPwaInstalled,
  onOpenAddModal,
}) => {
  const getGpsBadge = () => {
    if (isSimulating) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>شبیه‌ساز GPS فعال</span>
        </div>
      );
    }

    if (locationSource === 'ip') {
      return (
        <button
          type="button"
          onClick={onRetryGps}
          title="موقعیت بر اساس IP اینترنت تعیین شده است. برای ارتقا به GPS دقیق کلیک کنید."
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-300 text-sky-800 text-xs font-bold hover:bg-sky-100 transition"
        >
          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
          <span>موقعیت شبکه (IP) • ارتقا به GPS</span>
        </button>
      );
    }

    if (locationSource === 'manual') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-300 text-purple-800 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          <span>موقعیت دستی کاربر</span>
        </div>
      );
    }

    switch (gpsState) {
      case 'active':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>GPS زنده (دقت ±{toPersianDigits(userLocation.accuracy)}متر)</span>
          </div>
        );
      case 'searching':
        return (
          <button
            type="button"
            onClick={onRetryGps}
            title="کلیک برای تلاش مجدد جهت اتصال به ماهواره GPS"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
            <span>جستجوی ماهواره... (کلیک: تلاش مجدد)</span>
          </button>
        );
      case 'denied':
        return (
          <button
            type="button"
            onClick={onRetryGps}
            title="کلیک برای درخواست مجدد مجوز دسترسی به موقعیت"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>مجوز GPS مسدود (کلیک: فعال‌سازی)</span>
          </button>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>GPS آماده</span>
          </div>
        );
    }
  };

  return (
    <header className="relative z-30 w-full bg-white/95 border-b border-slate-200/90 backdrop-blur-md px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shadow-xs">
      {/* App Identity */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-slate-900 leading-tight">ردیاب موقعیت و Geofence</h1>
          <p className="text-[11px] text-slate-500">هشدارهای هوشمند نزدیکی به مقصد</p>
        </div>
      </div>

      {/* Center: GPS Status Pill */}
      <div className="flex items-center">{getGpsBadge()}</div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Add Destination Quick Button */}
        <button
          id="btn-add-destination-header"
          type="button"
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden xs:inline">مقصد جدید</span>
        </button>

        {/* Test Chime / Audio toggle */}
        <button
          id="btn-toggle-sound"
          type="button"
          onClick={() => {
            onToggleMute();
            if (isMuted) {
              soundEngine.playTapBeep();
            }
          }}
          title={isMuted ? 'صدا قطع است (کلیک برای فعال‌سازی)' : 'صدا فعال است (کلیک برای قطع)'}
          aria-label={isMuted ? 'صدا قطع است' : 'صدا فعال است'}
          className={`p-2 rounded-xl border transition text-xs flex items-center justify-center ${
            isMuted
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-500'
              : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {isMuted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>

        {/* Web Notification Permission Prompt */}
        {notificationPermission !== 'granted' && (
          <button
            id="btn-request-notification"
            type="button"
            onClick={onRequestNotificationPermission}
            title="فعال‌سازی اعلان‌های مرورگر"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="hidden md:inline">اعلان مرورگر</span>
          </button>
        )}

        {/* Simulation Mode Toggle */}
        <button
          id="btn-toggle-simulation"
          type="button"
          onClick={onToggleSimulation}
          title={isSimulating ? 'توقف شبیه‌سازی GPS' : 'آغاز تست و شبیه‌سازی GPS'}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
            isSimulating
              ? 'bg-amber-100 border-amber-400 text-amber-900'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="hidden sm:inline">{isSimulating ? 'تست فعال' : 'تست GPS'}</span>
        </button>

        {/* PWA Install Button */}
        {!isPwaInstalled && isPwaInstallable && (
          <button
            id="btn-pwa-install"
            type="button"
            onClick={onOpenInstallModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>نصب وب‌اپ</span>
          </button>
        )}
      </div>
    </header>
  );
};
