import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Destination, UserLocation, ActiveRoute } from '../types';
import { formatDistance, toPersianDigits } from '../utils/geo';

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
  const destinationLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initial centering tracking
  const hasInitiallyCenteredRef = useRef<boolean>(false);
  const [isManualPositioningMode, setIsManualPositioningMode] = useState<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return;

    const map = L.map(mapElementRef.current, {
      center: [userLocation.latitude, userLocation.longitude],
      zoom: 15,
      zoomControl: false,
    });

    // High quality OpenStreetMap tiles (standard light theme)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

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
    };
  }, []);

  // Center immediately on user upon initial position acquisition
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isRealPositionAcquired && !hasInitiallyCenteredRef.current) {
      hasInitiallyCenteredRef.current = true;
      map.flyTo([userLocation.latitude, userLocation.longitude], 16, {
        duration: 1.2,
      });
    }
  }, [isRealPositionAcquired, userLocation.latitude, userLocation.longitude]);

  // Recenter helper
  const handleRecenterUser = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setIsAutoFollowing(true);
    map.flyTo([userLocation.latitude, userLocation.longitude], 16, {
      duration: 1,
    });
  }, [userLocation.latitude, userLocation.longitude, setIsAutoFollowing]);

  // Update User Location Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const latLng: L.LatLngExpression = [userLocation.latitude, userLocation.longitude];

    const speedKmH = userLocation.speed != null ? Math.round(userLocation.speed * 3.6) : null;
    const speedText = speedKmH != null && speedKmH > 1 ? ` • ${toPersianDigits(speedKmH)} ک/س` : '';
    const headingDeg = userLocation.heading != null ? Math.round(userLocation.heading) : null;

    // Source Persian label
    const sourceLabel =
      locationSource === 'gps'
        ? 'GPS ماهواره‌ای'
        : locationSource === 'ip'
        ? 'تقریبی شبکه (IP)'
        : locationSource === 'simulated'
        ? 'شبیه‌ساز'
        : locationSource === 'manual'
        ? 'تنظیم دستی'
        : 'موقعیت شبکه';

    // Rich, visible user icon with radar waves and guaranteed dimensions
    const userIconHtml = `
      <div class="relative w-12 h-12 flex items-center justify-center cursor-pointer select-none">
        <!-- Floating Label Badge -->
        <div class="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-extrabold shadow-md border-2 border-white flex items-center gap-1.5 whitespace-nowrap pointer-events-none z-30">
          <span class="w-2 h-2 rounded-full bg-cyan-300 animate-ping"></span>
          <span>موقعیت شما${speedText}</span>
        </div>

        <!-- Translucent Pulsing Radar Rings -->
        <span class="absolute w-12 h-12 rounded-full bg-blue-500 opacity-25 animate-ping"></span>
        <span class="absolute w-9 h-9 rounded-full bg-blue-400 opacity-40 animate-pulse"></span>

        <!-- Solid Center Pin -->
        <div class="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center z-20">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>

        <!-- Heading Direction Arrow -->
        ${
          headingDeg != null
            ? `<div class="absolute -top-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-blue-600 z-10" style="transform: rotate(${headingDeg}deg);"></div>`
            : ''
        }
      </div>
    `;

    const customUserIcon = L.divIcon({
      html: userIconHtml,
      className: 'custom-user-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latLng);
      userMarkerRef.current.setIcon(customUserIcon);
    } else {
      const marker = L.marker(latLng, {
        icon: customUserIcon,
        zIndexOffset: 3000,
        draggable: true,
      }).addTo(map);

      // Enable dragging user location marker manually
      marker.on('dragend', (e) => {
        const target = e.target as L.Marker;
        const newPos = target.getLatLng();
        onManualSetUserLocation?.(newPos.lat, newPos.lng);
      });

      userMarkerRef.current = marker;
    }

    // Popup for user marker
    const userPopupContent = `
      <div class="p-2 text-right dir-rtl font-sans min-w-[200px]" style="direction: rtl;">
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
        <p class="text-[10px] text-slate-400 mt-2 text-center">می‌توانید این نشانگر را با کشیدن جابجا کنید.</p>
      </div>
    `;
    userMarkerRef.current.bindPopup(userPopupContent);

    // Accuracy Circle
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.setLatLng(latLng);
      userAccuracyCircleRef.current.setRadius(userLocation.accuracy || 15);
    } else {
      userAccuracyCircleRef.current = L.circle(latLng, {
        radius: userLocation.accuracy || 15,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '3 4',
      }).addTo(map);
    }

    // Auto-follow user in motion
    if (isAutoFollowing) {
      map.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }, [userLocation, isAutoFollowing, locationSource, onManualSetUserLocation]);

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

    // 3. Subtle animated dashed overlay along route
    const dashLine = L.polyline(activeRoute.coordinates, {
      color: '#60a5fa',
      weight: 2.5,
      opacity: 0.8,
      dashArray: '6 12',
      className: 'route-dash-animated',
    });
    routeGroup.addLayer(dashLine);

    // 4. Numbered Stop Waypoint Pins
    activeRoute.stops.forEach((stop, index) => {
      const isTarget = index === activeRoute.activeStopIndex;
      const stopNumber = toPersianDigits(index + 1);

      const waypointIconHtml = `
        <div class="relative flex flex-col items-center justify-center cursor-pointer group">
          <div class="flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg border-2 border-white bg-slate-900 text-white text-xs font-black whitespace-nowrap">
            <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold" style="background-color: ${stop.color || '#2563eb'};">
              ${stopNumber}
            </span>
            <span>${stop.name}</span>
            ${isTarget ? '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>' : ''}
          </div>
          <div class="w-2.5 h-2.5 rotate-45 -mt-1 rounded-xs shadow-xs" style="background-color: ${stop.color || '#2563eb'};"></div>
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
        <div class="p-2 text-right dir-rtl font-sans min-w-[180px]" style="direction: rtl;">
          <h4 class="font-bold text-sm text-slate-900">${stopNumber}. ${stop.name}</h4>
          <p class="text-xs text-slate-500 mt-1">توقف در مسیر سفر</p>
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

      // 2. Inner Arrival Geofence Circle
      const arrivalCircle = L.circle(latLng, {
        radius: dest.arrivalRadiusMeters,
        color: '#16a34a',
        fillColor: '#22c55e',
        fillOpacity: dest.enabled ? (isInsideArrival ? 0.4 : 0.18) : 0.05,
        weight: 1.5,
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

      // Interactive popup
      const formattedDist = distance !== undefined ? formatDistance(distance) : 'در حال محاسبه...';
      const statusBadge = !dest.enabled
        ? '<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">غیرفعال</span>'
        : isInsideArrival
        ? '<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold animate-pulse border border-emerald-300">رسیدید! 🎯</span>'
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
              <span class="text-slate-500">شعاع هشدار:</span>
              <span class="font-medium">${formatDistance(dest.radiusMeters)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">شعاع ورود کامل:</span>
              <span class="font-medium">${formatDistance(dest.arrivalRadiusMeters)}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 pt-1">
            <button id="pop-route-${dest.id}" class="w-full py-1.5 px-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center justify-center gap-1 shadow-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              <span>مسیریابی از مکان من به این نقطه</span>
            </button>
            <div class="flex gap-1.5">
              <button id="pop-toggle-${dest.id}" class="flex-1 py-1.5 px-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium transition">
                ${dest.enabled ? 'خاموش کردن' : 'روشن کردن'}
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
        const toggleBtn = document.getElementById(`pop-toggle-${dest.id}`);
        const editBtn = document.getElementById(`pop-edit-${dest.id}`);
        const delBtn = document.getElementById(`pop-del-${dest.id}`);

        if (routeBtn) {
          routeBtn.onclick = () => {
            onSelectDestination(dest);
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
  }, [destinations, distances]);

  // Recenter or fly to selected destination
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedDestination) return;
    setIsAutoFollowing(false);
    map.flyTo([selectedDestination.latitude, selectedDestination.longitude], 15, {
      duration: 0.8,
    });
  }, [selectedDestination, setIsAutoFollowing]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-full bg-slate-100">
      {/* The Leaflet Map Canvas */}
      <div ref={mapElementRef} id="leaflet-map-canvas" className="w-full h-full z-0" />

      {/* Floating Map Controls (Light Theme) */}
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
          aria-label="بزرگ‌نمایی"
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
          aria-label="کوچک‌نمایی"
          className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/95 hover:bg-white text-slate-700 border border-slate-200 shadow-md backdrop-blur-md transition active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12H6" />
          </svg>
        </button>
      </div>

      {/* Floating Status / Hints (Manual Mode Banner) */}
      {isManualPositioningMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce-short">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>روی نقشه لمس کنید تا موقعیت مکانی شما در آنجا قرار گیرد</span>
          <button
            type="button"
            onClick={() => setIsManualPositioningMode(false)}
            className="mr-2 px-2 py-0.5 rounded-lg bg-black/20 hover:bg-black/30 text-white text-[11px]"
          >
            لغو
          </button>
        </div>
      )}
    </div>
  );
};
