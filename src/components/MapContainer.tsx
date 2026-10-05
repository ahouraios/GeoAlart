import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Destination, UserLocation, ActiveRoute } from '../types';
import { formatDistance, toPersianDigits } from '../utils/geo';
import { IRAN_CITIES, CityPreset } from '../utils/defaults';
import { soundEngine } from '../utils/audio';

interface MapContainerProps {
  userLocation: UserLocation;
  isRealPositionAcquired: boolean;
  locationSource?: 'gps' | 'network' | 'ip' | 'manual' | 'simulated';
  destinations: Destination[];
  selectedDestination: Destination | null;
  distances: Record<string, number>;
  activeRoute: ActiveRoute | null;
  onMapClick: (lat: number, lon: number) => void;
  onSelectDestination: (dest: Destination) => void;
  onEditDestination: (dest: Destination) => void;
  onToggleDestination: (id: string) => void;
  onDeleteDestination: (id: string) => void;
  onAddDestinationToTrip?: (dest: Destination) => void;
  onAdvanceTripStop?: () => void;
  isSimulating: boolean;
  simulationClickMode: 'add_destination' | 'move_user';
  onSimulateMoveUser: (lat: number, lon: number) => void;
  onManualSetUserLocation?: (lat: number, lon: number) => void;
  isAutoFollowing: boolean;
  setIsAutoFollowing: (val: boolean) => void;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  userLocation,
  isRealPositionAcquired,
  locationSource = 'gps',
  destinations,
  selectedDestination,
  distances,
  activeRoute,
  onMapClick,
  onSelectDestination,
  onEditDestination,
  onToggleDestination,
  onDeleteDestination,
  onAddDestinationToTrip,
  onAdvanceTripStop,
  isSimulating,
  simulationClickMode,
  onSimulateMoveUser,
  onManualSetUserLocation,
  isAutoFollowing,
  setIsAutoFollowing,
}) => {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Markers and layers
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const userLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const destinationLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // States
  const hasInitiallyCenteredRef = useRef<boolean>(false);
  const [isManualPositioningMode, setIsManualPositioningMode] = useState<boolean>(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState<boolean>(false);
  const [isAutoSimulatingTravel, setIsAutoSimulatingTravel] = useState<boolean>(false);
  const autoSimTravelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Continuous heading tracking to prevent 360-degree jumping and sensor jitter
  const continuousHeadingRef = useRef<number>(userLocation.heading ?? 0);
  const lastRawAngleRef = useRef<number>(userLocation.heading ?? 0);
  const [displayHeading, setDisplayHeading] = useState<number>(userLocation.heading ?? 0);

  // Smooth heading updater with shortest angular distance & dead-band filtering
  const updateHeadingAngle = useCallback((rawAngle: number) => {
    const target = ((rawAngle % 360) + 360) % 360;

    // Shortest angular difference (-180 to +180) to eliminate full 360 spin on wrap-around
    let diff = target - (lastRawAngleRef.current % 360);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // Dead-band filter: ignore tiny micro-jitter (< 1.5 degrees) to eliminate jitter/trembling
    if (Math.abs(diff) < 1.5) return;

    lastRawAngleRef.current = target;
    continuousHeadingRef.current += diff;
    const newContinuousAngle = continuousHeadingRef.current;

    // Directly update CSS transform on Leaflet marker DOM element for buttery smooth 60fps rotation
    const rotator = document.getElementById('user-direction-rotator');
    if (rotator) {
      rotator.style.transform = `rotate(${newContinuousAngle}deg)`;
    }

    // Update display angle text for UI controls
    setDisplayHeading(Math.round(((newContinuousAngle % 360) + 360) % 360));
  }, []);

  // Sync when userLocation.heading changes (GPS movement)
  useEffect(() => {
    if (userLocation.heading != null) {
      updateHeadingAngle(userLocation.heading);
    }
  }, [userLocation.heading, updateHeadingAngle]);

  // Active DeviceOrientationEvent listener for real-time compass with jitter removal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let angle: number | null = null;
      // iOS Safari (webkitCompassHeading: 0 is magnetic North, clockwise)
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        angle = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android / Chrome: alpha is 0 to 360 degrees
        angle = (360 - e.alpha) % 360;
      }

      if (angle !== null && !isNaN(angle)) {
        updateHeadingAngle(angle);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    };
  }, [updateHeadingAngle]);

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return;

    const map = L.map(mapElementRef.current, {
      center: [userLocation.latitude, userLocation.longitude],
      zoom: 15,
      zoomControl: false,
    });

    // OpenStreetMap standard light layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    userLayerGroupRef.current = L.layerGroup().addTo(map);
    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    destinationLayersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Handle user manual pan/drag -> pause auto-follow
    map.on('dragstart', () => {
      setIsAutoFollowing(false);
    });

    // Handle Map Click
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (isManualPositioningMode) {
        onManualSetUserLocation?.(lat, lng);
        setIsManualPositioningMode(false);
      } else if (isSimulating && simulationClickMode === 'move_user') {
        onSimulateMoveUser(lat, lng);
      } else {
        onMapClick(lat, lng);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      userLayerGroupRef.current = null;
      userMarkerRef.current = null;
      userAccuracyCircleRef.current = null;
      destinationLayersGroupRef.current = null;
      routeLayerGroupRef.current = null;
    };
  }, []);

  // Recenter helper
  const handleRecenterUser = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setIsAutoFollowing(true);
    map.flyTo([userLocation.latitude, userLocation.longitude], 16, {
      duration: 1,
    });
  }, [userLocation.latitude, userLocation.longitude, setIsAutoFollowing]);

  // Center immediately on user upon initial position acquisition
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!hasInitiallyCenteredRef.current) {
      hasInitiallyCenteredRef.current = true;
      map.flyTo([userLocation.latitude, userLocation.longitude], 16, {
        duration: 1.2,
      });
    }
  }, [isRealPositionAcquired, userLocation.latitude, userLocation.longitude]);

  // Update User Location Marker & Accuracy Circle (Stable L.divIcon with CSS Synchronized Rotation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userGroup = userLayerGroupRef.current;
    if (!map || !userGroup) return;

    const latLng: L.LatLngExpression = [userLocation.latitude, userLocation.longitude];

    const speedKmH = userLocation.speed != null ? Math.round(userLocation.speed * 3.6) : null;
    const speedText = speedKmH != null && speedKmH > 1 ? ` • ${toPersianDigits(speedKmH)} ک/س` : '';

    // Source label
    const sourceLabel =
      locationSource === 'gps'
        ? 'ماهواره GPS زنده'
        : locationSource === 'ip'
        ? 'تقریبی شبکه (IP)'
        : locationSource === 'simulated'
        ? 'شبیه‌ساز تستی'
        : locationSource === 'manual'
        ? 'تنظیم دستی کاربر'
        : 'موقعیت شبکه';

    // Rich popup on tapping user marker
    const userPopupContent = `
      <div class="p-2 text-right dir-rtl font-sans min-w-[210px]" style="direction: rtl;">
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
          <div class="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></div>
          <h4 class="font-bold text-slate-800 text-sm">موقعیت زنده شما</h4>
        </div>
        <div class="space-y-1.5 text-xs text-slate-600">
          <div class="flex justify-between">
            <span class="text-slate-400">منبع موقعیت:</span>
            <span class="font-bold text-blue-600">${sourceLabel}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">دقت مکان‌یابی:</span>
            <span class="font-bold text-slate-800">±${toPersianDigits(userLocation.accuracy)} متر</span>
          </div>
          ${
            userLocation.speed != null
              ? `<div class="flex justify-between">
                   <span class="text-slate-400">سرعت حرکت:</span>
                   <span class="font-bold text-blue-600">${toPersianDigits(Math.round(userLocation.speed * 3.6))} کیلومتر/ساعت</span>
                 </div>`
              : ''
          }
          <div class="flex justify-between font-mono text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            <span>${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}</span>
          </div>
        </div>
        <p class="text-[10px] text-slate-500 mt-2 text-center bg-blue-50 py-1 rounded-lg">💡 این نشانگر را می‌توانید با انگشت یا ماوس بکشید و در هر نقطه بگذارید.</p>
      </div>
    `;

    // Directional Navigation Marker HTML (Position Dot with Directional Arrow & CSS Synchronized Rotator)
    const initialAngle = continuousHeadingRef.current;
    const userIconHtml = `
      <div id="user-marker-container" style="position: relative; width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: grab;">
        <!-- Top Floating Badge: موقعیت شما -->
        <div id="user-marker-badge" style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); background: #1d4ed8; color: #ffffff; font-size: 11px; font-weight: 800; font-family: system-ui, sans-serif; padding: 2px 9px; border-radius: 9999px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); white-space: nowrap; pointer-events: none; z-index: 1000; display: flex; align-items: center; gap: 4px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8;"></span>
          <span>موقعیت شما${speedText}</span>
        </div>

        <!-- Rotating Arrow & Beam Container (Synchronized via CSS transform to eliminate all jitter/flicker) -->
        <div id="user-direction-rotator" style="position: absolute; width: 72px; height: 72px; top: 0; left: 0; transform: rotate(${initialAngle}deg); transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.4, 1); transform-origin: 36px 36px; pointer-events: none;">
          <svg width="72" height="72" viewBox="0 0 72 72" style="overflow: visible; display: block;">
            <defs>
              <radialGradient id="gmapsHeadingBeam" cx="36" cy="36" r="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.6"/>
                <stop offset="40%" stop-color="#3b82f6" stop-opacity="0.32"/>
                <stop offset="75%" stop-color="#3b82f6" stop-opacity="0.08"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
              </radialGradient>
            </defs>

            <!-- 1. Directional Heading Light Beam / Cone (60 degree sector radiating forward) -->
            <path d="M 36,36 L 20,8 A 32,32 0 0,1 52,8 Z" fill="url(#gmapsHeadingBeam)" />

            <!-- 2. Sharp Directional Pointer Arrow (فلش نوک‌تیز جهت‌نما) -->
            <polygon points="36,4 47,21 36,17 25,21" fill="#1d4ed8" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));"/>
            <line x1="36" y1="6" x2="36" y2="16" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- Stationary Center Position Dot & Pulse Halo -->
        <svg width="72" height="72" viewBox="0 0 72 72" style="position: absolute; top: 0; left: 0; overflow: visible; display: block;">
          <!-- Pulsing Halo Ring -->
          <circle cx="36" cy="36" r="16" fill="#3b82f6" fill-opacity="0.2">
            <animate attributeName="r" values="12;19;12" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.3;0.05;0.3" dur="2s" repeatCount="indefinite"/>
          </circle>

          <!-- Drop shadow -->
          <circle cx="36" cy="37.5" r="9.5" fill="rgba(0,0,0,0.25)"/>

          <!-- Crisp White Ring Border -->
          <circle cx="36" cy="36" r="9" fill="#ffffff"/>

          <!-- Vibrant Google Blue Position Dot -->
          <circle cx="36" cy="36" r="6.8" fill="#1a73e8"/>

          <!-- Inner Core White Specular Dot -->
          <circle cx="36" cy="36" r="2.2" fill="#ffffff"/>
        </svg>
      </div>
    `;

    const customUserIcon = L.divIcon({
      html: userIconHtml,
      className: 'custom-user-marker',
      iconSize: [72, 72],
      iconAnchor: [36, 36],
    });

    // Create or update marker in Leaflet without recreating on orientation changes
    if (!userMarkerRef.current) {
      userGroup.clearLayers();

      // Accuracy Circle
      const accuracyCircle = L.circle(latLng, {
        radius: userLocation.accuracy || 20,
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.12,
        weight: 1.2,
      });
      userGroup.addLayer(accuracyCircle);
      userAccuracyCircleRef.current = accuracyCircle;

      // Directional User Marker
      const marker = L.marker(latLng, {
        icon: customUserIcon,
        zIndexOffset: 10000,
        draggable: true,
      });

      marker.on('dragend', (e) => {
        const target = e.target as L.Marker;
        const newPos = target.getLatLng();
        onManualSetUserLocation?.(newPos.lat, newPos.lng);
      });

      marker.bindPopup(userPopupContent);
      userGroup.addLayer(marker);
      userMarkerRef.current = marker;
    } else {
      // Smoothly update location and popup without recreating DOM elements or flickering
      userMarkerRef.current.setLatLng(latLng);
      userAccuracyCircleRef.current?.setLatLng(latLng);
      userAccuracyCircleRef.current?.setRadius(userLocation.accuracy || 20);
      userMarkerRef.current.setPopupContent(userPopupContent);
    }

    // Auto-follow user in motion
    if (isAutoFollowing) {
      map.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }, [
    userLocation.latitude,
    userLocation.longitude,
    userLocation.accuracy,
    userLocation.speed,
    isAutoFollowing,
    locationSource,
    onManualSetUserLocation,
  ]);

  // Update Route Polyline & Journey Waypoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeLayerGroupRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    if (!activeRoute || activeRoute.coordinates.length < 2) return;

    // 1. Shadow / Outer Border Line
    const borderLine = L.polyline(activeRoute.coordinates, {
      color: '#1e3a8a',
      weight: 8,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    });
    routeGroup.addLayer(borderLine);

    // 2. High-Contrast Inner Route Line
    const mainLine = L.polyline(activeRoute.coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    });
    routeGroup.addLayer(mainLine);

    // 3. Animated dashed overlay
    const dashLine = L.polyline(activeRoute.coordinates, {
      color: '#93c5fd',
      weight: 2.5,
      opacity: 0.85,
      dashArray: '6 12',
      className: 'route-dash-animated',
    });
    routeGroup.addLayer(dashLine);

    // 4. Numbered Stop Waypoint Pins
    activeRoute.stops.forEach((stop, index) => {
      const isTarget = index === activeRoute.activeStopIndex;
      const stopNumber = toPersianDigits(index + 1);

      const waypointIconHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 9999px; border: 2px solid #ffffff; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: ${stop.color || '#2563eb'}; color: #ffffff; font-size: 10px; font-weight: 900;">
              ${stopNumber}
            </span>
            <span>${stop.name}</span>
            ${isTarget ? '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span>' : ''}
          </div>
          <div style="width: 8px; height: 8px; transform: rotate(45deg); margin-top: -4px; background: ${stop.color || '#2563eb'};"></div>
        </div>
      `;

      const waypointIcon = L.divIcon({
        html: waypointIconHtml,
        className: 'custom-waypoint-marker',
        iconSize: [120, 36],
        iconAnchor: [60, 34],
      });

      const wpMarker = L.marker([stop.latitude, stop.longitude], {
        icon: waypointIcon,
        zIndexOffset: 1500 + index,
      });

      wpMarker.bindPopup(`
        <div class="p-2 text-right dir-rtl font-sans min-w-[190px]" style="direction: rtl;">
          <h4 class="font-bold text-sm text-slate-900">${stopNumber}. ${stop.name}</h4>
          <p class="text-xs text-slate-500 mt-1">توقف شماره ${stopNumber} در این سفر</p>
        </div>
      `);

      routeGroup.addLayer(wpMarker);
    });
  }, [activeRoute]);

  // Update Destination Markers & Geofences
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = destinationLayersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    destinations.forEach((dest) => {
      const latLng: L.LatLngExpression = [dest.latitude, dest.longitude];
      const distance = distances[dest.id];
      const isInsideWarning = distance !== undefined && distance <= dest.radiusMeters;
      const isInsideArrival = distance !== undefined && distance <= dest.arrivalRadiusMeters;

      // 1. Outer Warning Geofence Circle
      const warningCircle = L.circle(latLng, {
        radius: dest.radiusMeters,
        color: dest.color,
        fillColor: dest.color,
        fillOpacity: dest.enabled ? (isInsideWarning ? 0.24 : 0.1) : 0.03,
        weight: dest.enabled ? (isInsideWarning ? 3 : 2) : 1,
        dashArray: dest.enabled ? undefined : '5 5',
      });
      layerGroup.addLayer(warningCircle);

      // 2. Inner Arrival Geofence Circle (Accurate 20m arrival threshold)
      const arrivalCircle = L.circle(latLng, {
        radius: dest.arrivalRadiusMeters,
        color: '#16a34a',
        fillColor: '#22c55e',
        fillOpacity: dest.enabled ? (isInsideArrival ? 0.45 : 0.22) : 0.05,
        weight: 1.8,
      });
      layerGroup.addLayer(arrivalCircle);

      // 3. Custom Destination Pin Icon
      const pinHtml = `
        <div class="relative group cursor-pointer transition-transform hover:scale-110">
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md border border-slate-200/90 bg-white/95 text-xs font-bold whitespace-nowrap"
               style="color: ${dest.enabled ? '#0f172a' : '#94a3b8'};">
            <span class="w-2.5 h-2.5 rounded-full ${dest.enabled ? 'animate-pulse' : 'opacity-40'}" style="background-color: ${dest.color}"></span>
            <span>${dest.name}</span>
          </div>
          <div class="w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 rounded-xs shadow-xs" style="background-color: ${dest.color}"></div>
        </div>
      `;

      const destIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-dest-marker',
        iconSize: [120, 36],
        iconAnchor: [60, 32],
      });

      const marker = L.marker(latLng, { icon: destIcon });

      const formattedDist = distance !== undefined ? formatDistance(distance) : 'در حال محاسبه...';
      const statusBadge = !dest.enabled
        ? '<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">غیرفعال</span>'
        : isInsideArrival
        ? '<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold animate-pulse border border-emerald-300">رسیدید! 🎯 (زیر ۲۰ متر)</span>'
        : isInsideWarning
        ? '<span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse border border-amber-300">در محدوده هشدار 🔔</span>'
        : '<span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">فعال</span>';

      const popupContent = `
        <div class="p-2 text-right dir-rtl font-sans min-w-[220px]" style="direction: rtl;">
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
            <h4 class="font-bold text-slate-800 text-sm">${dest.name}</h4>
            ${statusBadge}
          </div>
          ${dest.description ? `<p class="text-xs text-slate-600 mb-2 leading-relaxed">${dest.description}</p>` : ''}
          <div class="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
            <div class="flex justify-between">
              <span class="text-slate-500">فاصله لحظه‌ای:</span>
              <strong class="text-blue-600 font-bold">${formattedDist}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">شعاع هشدار نزدیکی:</span>
              <span class="font-medium">${formatDistance(dest.radiusMeters)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">شعاع اعلام رسیدن دقیق:</span>
              <strong class="text-emerald-700 font-bold">${formatDistance(dest.arrivalRadiusMeters)}</strong>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 pt-1">
            <button id="pop-route-${dest.id}" class="w-full py-1.5 px-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center justify-center gap-1 shadow-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              <span>مسیریابی از مکان من به این مقصد</span>
            </button>
            <button id="pop-add-trip-${dest.id}" class="w-full py-1.5 px-2 text-xs rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition flex items-center justify-center gap-1 border border-indigo-200">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
              <span>+ افزودن به سفر چند مقصده</span>
            </button>
            <div class="flex gap-1.5">
              <button id="pop-toggle-${dest.id}" class="flex-1 py-1.5 px-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium transition">
                ${dest.enabled ? 'خاموش' : 'روشن'}
              </button>
              <button id="pop-edit-${dest.id}" class="py-1.5 px-2.5 text-xs rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition">
                ویرایش
              </button>
              <button id="pop-del-${dest.id}" class="py-1.5 px-2.5 text-xs rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium transition">
                حذف
              </button>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: true,
        className: 'modern-custom-popup',
      });

      marker.on('popupopen', () => {
        onSelectDestination(dest);
        const routeBtn = document.getElementById(`pop-route-${dest.id}`);
        const addTripBtn = document.getElementById(`pop-add-trip-${dest.id}`);
        const toggleBtn = document.getElementById(`pop-toggle-${dest.id}`);
        const editBtn = document.getElementById(`pop-edit-${dest.id}`);
        const delBtn = document.getElementById(`pop-del-${dest.id}`);

        if (routeBtn) {
          routeBtn.onclick = () => {
            onSelectDestination(dest);
            marker.closePopup();
          };
        }
        if (addTripBtn) {
          addTripBtn.onclick = () => {
            onAddDestinationToTrip?.(dest);
            marker.closePopup();
          };
        }
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            onToggleDestination(dest.id);
            marker.closePopup();
          };
        }
        if (editBtn) {
          editBtn.onclick = () => {
            onEditDestination(dest);
            marker.closePopup();
          };
        }
        if (delBtn) {
          delBtn.onclick = () => {
            onDeleteDestination(dest.id);
            marker.closePopup();
          };
        }
      });

      layerGroup.addLayer(marker);
    });
  }, [destinations, distances, onAddDestinationToTrip]);

  // Recenter or fly to selected destination
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedDestination) return;
    setIsAutoFollowing(false);
    map.flyTo([selectedDestination.latitude, selectedDestination.longitude], 15, {
      duration: 0.8,
    });
  }, [selectedDestination, setIsAutoFollowing]);

  // City selection handler
  const handleSelectCity = (city: CityPreset) => {
    onManualSetUserLocation?.(city.lat, city.lon);
    setIsCityPickerOpen(false);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([city.lat, city.lon], 14, { duration: 1 });
    }
  };

  // Auto-simulate movement along route
  const toggleAutoSimulateTravel = () => {
    if (isAutoSimulatingTravel) {
      if (autoSimTravelIntervalRef.current) {
        clearInterval(autoSimTravelIntervalRef.current);
        autoSimTravelIntervalRef.current = null;
      }
      setIsAutoSimulatingTravel(false);
      return;
    }

    if (!activeRoute || activeRoute.coordinates.length < 2) return;

    setIsAutoSimulatingTravel(true);
    let stepIndex = 0;
    const coords = activeRoute.coordinates;

    autoSimTravelIntervalRef.current = setInterval(() => {
      if (stepIndex >= coords.length) {
        if (autoSimTravelIntervalRef.current) {
          clearInterval(autoSimTravelIntervalRef.current);
          autoSimTravelIntervalRef.current = null;
        }
        setIsAutoSimulatingTravel(false);
        return;
      }

      const point = coords[stepIndex];
      onSimulateMoveUser(point[0], point[1]);
      stepIndex += 1;
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (autoSimTravelIntervalRef.current) {
        clearInterval(autoSimTravelIntervalRef.current);
      }
    };
  }, []);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  // Current active stop info
  const currentTargetStop =
    activeRoute && activeRoute.stops.length > 0
      ? activeRoute.stops[activeRoute.activeStopIndex]
      : null;

  return (
    <div className="relative w-full h-full bg-slate-100">
      {/* The Leaflet Map Canvas */}
      <div ref={mapElementRef} id="leaflet-map-canvas" className="w-full h-full z-0" />

      {/* Google Maps Authentic Bottom-Right Floating Locator Target Button */}
      <div className="absolute bottom-24 right-4 z-20 pointer-events-auto flex flex-col items-center gap-2">
        <button
          id="btn-gmaps-locator"
          type="button"
          onClick={handleRecenterUser}
          title="مرکز کردن نقشه روی موقعیت من"
          aria-label="مرکز کردن نقشه"
          className="w-13 h-13 rounded-full bg-white text-blue-600 shadow-2xl border border-slate-200/90 flex items-center justify-center transition active:scale-90 hover:bg-slate-50 ring-4 ring-black/5"
        >
          <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
          </div>
        </button>
      </div>

      {/* Floating Map Controls (Right Side) */}
      <div className="absolute top-16 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* Recenter / My Location Button */}
        <button
          id="btn-recenter-location"
          type="button"
          onClick={handleRecenterUser}
          title="پرش به مکان من و دنبال کردن حرکت"
          aria-label="مکان من"
          className={`w-11 h-11 flex items-center justify-center rounded-2xl border shadow-md backdrop-blur-md transition active:scale-95 ${
            isAutoFollowing
              ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/25 ring-2 ring-blue-400/40'
              : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" strokeWidth="2.5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          </svg>
        </button>

        {/* Rotate Angle / Compass Heading Test Button */}
        <button
          id="btn-rotate-heading"
          type="button"
          onClick={() => {
            const nextAngle = continuousHeadingRef.current + 45;
            updateHeadingAngle(nextAngle);
          }}
          title={`زاویه کنونی فلش جهت‌نما: ${toPersianDigits(displayHeading)} درجه (کلیک: چرخش نرم)`}
          aria-label="چرخش زاویه جهت"
          className="w-11 h-11 flex flex-col items-center justify-center rounded-2xl bg-white/95 hover:bg-white text-blue-600 border border-slate-200 shadow-md backdrop-blur-md transition active:scale-95 group"
        >
          <svg
            className="w-5 h-5 transition-transform duration-300"
            style={{ transform: `rotate(${displayHeading}deg)` }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <polygon points="12,2 17,21 12,17 7,21" fill="#1a73e8" stroke="#1a73e8" strokeWidth="1.5" />
          </svg>
          <span className="text-[9px] font-black leading-none mt-0.5 text-slate-600 font-mono">
            {toPersianDigits(displayHeading)}°
          </span>
        </button>

        {/* Quick City Selector Button */}
        <button
          type="button"
          onClick={() => setIsCityPickerOpen((prev) => !prev)}
          title="انتخاب شهر برای تنظیم موقعیت من"
          aria-label="انتخاب شهر"
          className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/95 hover:bg-white text-slate-700 border border-slate-200 shadow-md backdrop-blur-md transition active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </button>

        {/* Manual Location Pinpoint Button (Move My Location on Map) */}
        <button
          id="btn-manual-pin-user"
          type="button"
          onClick={() => setIsManualPositioningMode((prev) => !prev)}
          title={isManualPositioningMode ? 'انصراف از تعیین دستی موقعیت' : 'تنظیم موقعیت من با لمس نقشه'}
          aria-label="تنظیم موقعیت دستی"
          className={`w-11 h-11 flex items-center justify-center rounded-2xl border shadow-md backdrop-blur-md transition active:scale-95 ${
            isManualPositioningMode
              ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/25 ring-2 ring-amber-300'
              : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>

        {/* Zoom In */}
        <button
          id="btn-zoom-in"
          type="button"
          onClick={handleZoomIn}
          title="بزرگ‌نمایی"
          className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/95 hover:bg-white text-slate-700 border border-slate-200 shadow-md backdrop-blur-md transition active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v12m6-6H6" />
          </svg>
        </button>

        {/* Zoom Out */}
        <button
          id="btn-zoom-out"
          type="button"
          onClick={handleZoomOut}
          title="کوچک‌نمایی"
          className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/95 hover:bg-white text-slate-700 border border-slate-200 shadow-md backdrop-blur-md transition active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12H6" />
          </svg>
        </button>
      </div>

      {/* Quick City Picker Dialog */}
      {isCityPickerOpen && (
        <div className="absolute top-16 right-16 z-30 bg-white/95 border border-slate-200 rounded-2xl shadow-2xl backdrop-blur-md p-3 w-64 max-h-80 overflow-y-auto animate-fade-in" dir="rtl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">انتخاب شهر موقعیت شما:</span>
            <button
              type="button"
              onClick={() => setIsCityPickerOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {IRAN_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => handleSelectCity(c)}
                className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-bold text-slate-800 text-center transition active:scale-95"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Pinning Notification Banner */}
      {isManualPositioningMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce-short">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>روی هر نقطه از نقشه لمس کنید تا موقعیت شما در آنجا تنظیم شود</span>
          <button
            type="button"
            onClick={() => setIsManualPositioningMode(false)}
            className="mr-2 px-2 py-0.5 rounded-lg bg-black/20 hover:bg-black/30 text-white text-[11px]"
          >
            لغو
          </button>
        </div>
      )}

      {/* Step-by-Step Live Journey HUD (e.g. خانه -> محل کار -> خانه مامان) */}
      {activeRoute && currentTargetStop && (
        <div className="absolute bottom-24 left-4 z-20 pointer-events-auto bg-slate-900/90 text-white backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl max-w-xs animate-fade-in" dir="rtl">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-extrabold">
              مرحله {toPersianDigits(activeRoute.activeStopIndex + 1)} از {toPersianDigits(activeRoute.stops.length)}
            </span>
            <button
              type="button"
              onClick={() => soundEngine.speakPersian(`حرکت به سمت ${currentTargetStop.name}`)}
              title="پخش صوتی راهنما"
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            </button>
          </div>

          <div className="text-xs font-black text-white truncate">
            هدف فعلی: {currentTargetStop.name}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
            <span>فاصله مستقیم:</span>
            <strong className="text-cyan-400 font-bold">
              {distances[currentTargetStop.id] !== undefined ? formatDistance(distances[currentTargetStop.id]) : '—'}
            </strong>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
            <span>دقت اعلام رسیدن:</span>
            <strong className="text-emerald-400 font-bold">
              {toPersianDigits(currentTargetStop.arrivalRadiusMeters || 20)} متر
            </strong>
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-700/60">
            {activeRoute.activeStopIndex < activeRoute.stops.length - 1 && (
              <button
                type="button"
                onClick={onAdvanceTripStop}
                className="flex-1 py-1 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-xs text-center"
              >
                رسیدم (مقصد بعدی ➔)
              </button>
            )}

            <button
              type="button"
              onClick={toggleAutoSimulateTravel}
              className={`py-1 px-2.5 rounded-xl font-bold text-[10px] transition ${
                isAutoSimulatingTravel
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {isAutoSimulatingTravel ? 'توقف حرکت' : 'تست خودکار حرکت'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
