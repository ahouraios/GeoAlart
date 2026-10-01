import React from 'react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  onTriggerInstall: () => Promise<boolean>;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  onTriggerInstall,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-900 text-right dir-rtl">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-4 mx-auto shadow-md shadow-blue-500/20">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>

        <h3 className="text-base font-bold text-center text-slate-900 mb-1">
          نصب وب‌اپلیکیشن (PWA)
        </h3>
        <p className="text-xs text-slate-500 text-center mb-5 leading-relaxed">
          با نصب برنامه روی صفحه اصلی گوشی یا دسکتاپ، از عملکرد سریع‌تر، دسترسی تمام‌صفحه و هشدارهای دقیق‌تر بهره‌مند شوید.
        </p>

        {isIOS ? (
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 mb-5">
            <div className="font-bold text-slate-900">مراحل نصب در آیفون (iOS Safari):</div>
            <p className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">۱</span>
              دکمه <strong className="text-blue-600">Share</strong> (اشتراک‌گذاری) در نوار پایین مرورگر را لمس کنید.
            </p>
            <p className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">۲</span>
              گزینه <strong className="text-blue-600">Add to Home Screen</strong> (افزودن به صفحه اصلی) را انتخاب کنید.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const installed = await onTriggerInstall();
              if (installed) onClose();
            }}
            className="w-full py-2.5 px-4 mb-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>تایید و نصب روی دستگاه</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
        >
          بستن
        </button>
      </div>
    </div>
  );
};
