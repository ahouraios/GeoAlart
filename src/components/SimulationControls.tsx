import React, { useState, useEffect, useRef } from 'react';
import { Destination, UserLocation } from '../types';

interface SimulationControlsProps {
  userLocation: UserLocation;
  onSimulateMoveUser: (lat: number, lon: number) => void;
  destinations: Destination[];
  onToggleSimulation: () => void;
  simulationClickMode: 'add_destination' | 'move_user';
  onSetSimulationClickMode: (mode: 'add_destination' | 'move_user') => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  userLocation,
  onSimulateMoveUser,
  destinations,
  onToggleSimulation,
  simulationClickMode,
  onSetSimulationClickMode,
}) => {
  const [isAutoMoving, setIsAutoMoving] = useState(false);
  const autoMoveTimerRef = useRef<number | null>(null);

  const activeDestinations = destinations.filter((d) => d.enabled);
  const closestDestination = activeDestinations[0] || destinations[0];

  useEffect(() => {
    return () => {
      if (autoMoveTimerRef.current) {
        clearInterval(autoMoveTimerRef.current);
      }
    };
  }, []);

  // Teleport right inside warning zone
  const handleTeleportInsideWarning = () => {
    if (!closestDestination) return;
    const offsetLat = (closestDestination.radiusMeters * 0.8) / 111320;
    onSimulateMoveUser(closestDestination.latitude + offsetLat, closestDestination.longitude);
  };

  // Teleport right inside arrival zone
  const handleTeleportArrival = () => {
    if (!closestDestination) return;
    const offsetLat = (closestDestination.arrivalRadiusMeters * 0.5) / 111320;
    onSimulateMoveUser(closestDestination.latitude + offsetLat, closestDestination.longitude);
  };

  // Automated step-by-step walk toward the closest destination
  const handleToggleAutoMove = () => {
    if (isAutoMoving) {
      if (autoMoveTimerRef.current) {
        clearInterval(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
      setIsAutoMoving(false);
      return;
    }

    if (!closestDestination) return;

    setIsAutoMoving(true);
    let currentLat = userLocation.latitude;
    let currentLon = userLocation.longitude;
    const targetLat = closestDestination.latitude;
    const targetLon = closestDestination.longitude;

    autoMoveTimerRef.current = window.setInterval(() => {
      const dLat = targetLat - currentLat;
      const dLon = targetLon - currentLon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);

      if (dist < 0.0001) {
        // Arrived at target
        if (autoMoveTimerRef.current) {
          clearInterval(autoMoveTimerRef.current);
          autoMoveTimerRef.current = null;
        }
        setIsAutoMoving(false);
        return;
      }

      // Move ~15-20 meters per second step
      const step = 0.00018;
      currentLat += (dLat / dist) * step;
      currentLon += (dLon / dist) * step;
      onSimulateMoveUser(currentLat, currentLon);
    }, 1000);
  };

  return (
    <div className="absolute top-28 left-4 z-20 max-w-xs w-68 bg-white/95 border border-amber-300 rounded-3xl p-3.5 shadow-xl backdrop-blur-xl text-slate-900 space-y-2.5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>شبیه‌ساز و تست میدانی GPS</span>
        </div>
        <button
          type="button"
          onClick={onToggleSimulation}
          className="text-slate-400 hover:text-slate-700 text-xs p-1"
          title="بستن شبیه‌ساز"
        >
          ✕
        </button>
      </div>

      {/* Map click mode switch */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 text-[11px] font-medium border border-slate-200/80">
        <button
          type="button"
          onClick={() => onSetSimulationClickMode('move_user')}
          className={`py-1.5 rounded-lg transition ${
            simulationClickMode === 'move_user'
              ? 'bg-amber-500 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          کلیک = حرکت کاربر
        </button>
        <button
          type="button"
          onClick={() => onSetSimulationClickMode('add_destination')}
          className={`py-1.5 rounded-lg transition ${
            simulationClickMode === 'add_destination'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          کلیک = ثبت مقصد
        </button>
      </div>

      {/* Quick Teleport and Walk Simulator */}
      {closestDestination ? (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] text-slate-500 truncate">
            مقصد هدف: <strong className="text-slate-800">{closestDestination.name}</strong>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleTeleportInsideWarning}
              className="px-2 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold transition active:scale-95"
            >
              ورود به هشدار (🔔)
            </button>
            <button
              type="button"
              onClick={handleTeleportArrival}
              className="px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold transition active:scale-95"
            >
              رسیدن کامل (🎯)
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleAutoMove}
            className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs ${
              isAutoMoving
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isAutoMoving ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>توقف حرکت خودکار</span>
              </>
            ) : (
              <span>شروع حرکت خودکار به سمت مقصد</span>
            )}
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">یک مقصد تعریف کنید تا بتوانید حرکت به سوی آن را تست کنید.</p>
      )}
    </div>
  );
};
