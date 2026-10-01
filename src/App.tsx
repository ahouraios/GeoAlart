import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Destination, AlertNotificationItem, ActiveRoute, TripStop } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { usePWAInstall } from './hooks/usePWAInstall';
import { calculateHaversineDistance } from './utils/geo';
import { calculateRoute } from './utils/routing';
import { soundEngine } from './utils/audio';
import { notificationManager } from './utils/notifications';
import { DEFAULT_DESTINATIONS } from './utils/defaults';
import { MapContainer } from './components/MapContainer';
import { StatusBar } from './components/StatusBar';
import { DestinationList } from './components/DestinationList';
import { AddDestinationModal } from './components/AddDestinationModal';
import { AlertBanner } from './components/AlertBanner';
import { SimulationControls } from './components/SimulationControls';
import { PWAInstallModal } from './components/PWAInstallModal';
import { TripRoutePanel } from './components/TripRoutePanel';

export default function App() {
  // Geolocation Hook
  const {
    location,
    gpsState,
    errorMessage,
    isSimulating,
    isRealPositionAcquired,
    locationSource,
    startTracking,
    setManualLocation,
    setSimulatedLocation,
    toggleSimulation,
  } = useGeolocation();

  // PWA Hook
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Saved Destinations State
  const [destinations, setDestinations] = useState<Destination[]>(() => {
    const saved = localStorage.getItem('geofence_destinations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // use default
      }
    }
    return DEFAULT_DESTINATIONS;
  });

  // UI States
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [isAutoFollowing, setIsAutoFollowing] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [clickedMapCoords, setClickedMapCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.getIsMuted());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    notificationManager.getPermissionStatus()
  );
  const [simulationClickMode, setSimulationClickMode] = useState<'add_destination' | 'move_user'>('add_destination');
  const [activeAlerts, setActiveAlerts] = useState<AlertNotificationItem[]>([]);

  // Ref to debounce route recalculations
  const routeRecalcTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Persist destinations to localStorage
  useEffect(() => {
    localStorage.setItem('geofence_destinations', JSON.stringify(destinations));
  }, [destinations]);

  // Compute live linear distances to each destination
  const distances = useMemo(() => {
    const map: Record<string, number> = {};
    destinations.forEach((dest) => {
      map[dest.id] = calculateHaversineDistance(
        location.latitude,
        location.longitude,
        dest.latitude,
        dest.longitude
      );
    });
    return map;
  }, [location.latitude, location.longitude, destinations]);

  // Geofence Evaluation Effect
  useEffect(() => {
    destinations.forEach((dest) => {
      const distance = distances[dest.id];
      if (distance === undefined) return;

      const alertItem = notificationManager.evaluateDestination(dest, distance);
      if (alertItem) {
        setActiveAlerts((prev) => [alertItem, ...prev.slice(0, 4)]);

        // If arrived at the current active stop in the multi-destination trip, advance to next stop
        if (alertItem.type === 'arrival' && activeRoute) {
          const currentStop = activeRoute.stops[activeRoute.activeStopIndex];
          if (currentStop && currentStop.id === dest.id) {
            if (activeRoute.activeStopIndex < activeRoute.stops.length - 1) {
              setActiveRoute((prev) =>
                prev ? { ...prev, activeStopIndex: prev.activeStopIndex + 1 } : null
              );
            }
          }
        }
      }
    });
  }, [distances, destinations, activeRoute]);

  // Auto-dismiss alerts after 8 seconds
  useEffect(() => {
    if (activeAlerts.length === 0) return;
    const timer = setTimeout(() => {
      setActiveAlerts((prev) => prev.slice(0, prev.length - 1));
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeAlerts]);

  // Helper to recompute route for a list of stops
  const recomputeRoute = useCallback(
    async (stops: TripStop[], activeIdx: number = 0) => {
      if (stops.length === 0) {
        setActiveRoute(null);
        return;
      }

      const points = [
        { lat: location.latitude, lon: location.longitude },
        ...stops.map((s) => ({ lat: s.latitude, lon: s.longitude })),
      ];

      const res = await calculateRoute(points);

      setActiveRoute({
        coordinates: res.coordinates,
        distanceMeters: res.distanceMeters,
        durationSeconds: res.durationSeconds,
        stops,
        activeStopIndex: activeIdx,
        source: res.source,
        isLoading: false,
      });
    },
    [location.latitude, location.longitude]
  );

  // When clicking any destination in the list: draw route from User to that destination!
  const handleRouteToDestination = useCallback(
    (dest: Destination) => {
      setSelectedDestination(dest);
      const stop: TripStop = {
        id: dest.id,
        name: dest.name,
        latitude: dest.latitude,
        longitude: dest.longitude,
        color: dest.color,
        radiusMeters: dest.radiusMeters,
        arrivalRadiusMeters: dest.arrivalRadiusMeters,
      };

      // Set initial direct route immediately while full road route is computed
      setActiveRoute({
        coordinates: [
          [location.latitude, location.longitude],
          [dest.latitude, dest.longitude],
        ],
        distanceMeters: distances[dest.id] || 0,
        durationSeconds: Math.round((distances[dest.id] || 0) / 9.7),
        stops: [stop],
        activeStopIndex: 0,
        source: 'direct',
        isLoading: true,
      });

      // Fetch precise road route
      recomputeRoute([stop], 0);
    },
    [location.latitude, location.longitude, distances, recomputeRoute]
  );

  // Add another destination to the active multi-stop trip
  const handleAddDestinationToTrip = useCallback(
    (dest: Destination) => {
      const stop: TripStop = {
        id: dest.id,
        name: dest.name,
        latitude: dest.latitude,
        longitude: dest.longitude,
        color: dest.color,
        radiusMeters: dest.radiusMeters,
        arrivalRadiusMeters: dest.arrivalRadiusMeters,
      };

      if (!activeRoute) {
        handleRouteToDestination(dest);
        return;
      }

      // Avoid duplicates in the same trip
      if (activeRoute.stops.some((s) => s.id === dest.id)) {
        return;
      }

      const updatedStops = [...activeRoute.stops, stop];
      recomputeRoute(updatedStops, activeRoute.activeStopIndex);
    },
    [activeRoute, handleRouteToDestination, recomputeRoute]
  );

  // Remove a stop from the active trip
  const handleRemoveStopFromTrip = useCallback(
    (index: number) => {
      if (!activeRoute) return;
      const updatedStops = activeRoute.stops.filter((_, i) => i !== index);
      if (updatedStops.length === 0) {
        setActiveRoute(null);
        return;
      }
      const nextIdx = Math.min(activeRoute.activeStopIndex, updatedStops.length - 1);
      recomputeRoute(updatedStops, nextIdx);
    },
    [activeRoute, recomputeRoute]
  );

  // Move stop up or down in the trip order
  const handleMoveStop = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!activeRoute) return;
      if (toIndex < 0 || toIndex >= activeRoute.stops.length) return;

      const newStops = [...activeRoute.stops];
      const [moved] = newStops.splice(fromIndex, 1);
      newStops.splice(toIndex, 0, moved);

      recomputeRoute(newStops, activeRoute.activeStopIndex);
    },
    [activeRoute, recomputeRoute]
  );

  // Clear trip
  const handleClearTrip = useCallback(() => {
    setActiveRoute(null);
  }, []);

  // Update route when user moves (debounced every 3 seconds if location shifted)
  useEffect(() => {
    if (!activeRoute || activeRoute.stops.length === 0) return;

    if (routeRecalcTimerRef.current) {
      clearTimeout(routeRecalcTimerRef.current);
    }

    routeRecalcTimerRef.current = setTimeout(() => {
      recomputeRoute(activeRoute.stops, activeRoute.activeStopIndex);
    }, 2500);

    return () => {
      if (routeRecalcTimerRef.current) {
        clearTimeout(routeRecalcTimerRef.current);
      }
    };
  }, [location.latitude, location.longitude]);

  // Handle map click: prompt to add destination
  const handleMapClick = useCallback((lat: number, lon: number) => {
    setClickedMapCoords({ lat, lon });
    setEditingDestination(null);
    setIsAddModalOpen(true);
  }, []);

  // Handle save / update destination
  const handleSaveDestination = (
    data: Omit<Destination, 'id' | 'createdAt'> & { id?: string }
  ) => {
    if (data.id) {
      setDestinations((prev) =>
        prev.map((d) => (d.id === data.id ? { ...d, ...data } : d))
      );
      notificationManager.resetDestination(data.id);
    } else {
      const newDest: Destination = {
        ...data,
        id: `dest-${Date.now()}`,
        createdAt: Date.now(),
      };
      setDestinations((prev) => [newDest, ...prev]);
      setSelectedDestination(newDest);
      handleRouteToDestination(newDest);
    }
  };

  // Toggle destination alert enabled
  const handleToggleDestination = (id: string) => {
    setDestinations((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const nextState = !d.enabled;
          if (!nextState) {
            notificationManager.resetDestination(id);
          }
          return { ...d, enabled: nextState };
        }
        return d;
      })
    );
  };

  // Delete destination
  const handleDeleteDestination = (id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    notificationManager.resetDestination(id);
    if (selectedDestination?.id === id) {
      setSelectedDestination(null);
    }
    if (activeRoute && activeRoute.stops.some((s) => s.id === id)) {
      const remaining = activeRoute.stops.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        setActiveRoute(null);
      } else {
        recomputeRoute(remaining, 0);
      }
    }
  };

  // Edit destination trigger
  const handleEditDestination = (dest: Destination) => {
    setEditingDestination(dest);
    setClickedMapCoords(null);
    setIsAddModalOpen(true);
  };

  // Request notification permissions
  const handleRequestNotification = async () => {
    const perm = await notificationManager.requestPermission();
    setNotificationPermission(perm);
  };

  // Toggle sound
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Dismiss in-app alert
  const handleDismissAlert = (id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans select-none"
      dir="rtl"
    >
      {/* Top Status & Controls Bar */}
      <StatusBar
        gpsState={gpsState}
        userLocation={location}
        locationSource={locationSource}
        onRetryGps={startTracking}
        isSimulating={isSimulating}
        onToggleSimulation={toggleSimulation}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={handleRequestNotification}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isPwaInstallable={isInstallable}
        isPwaInstalled={isInstalled}
        onOpenAddModal={() => {
          setEditingDestination(null);
          setClickedMapCoords(null);
          setIsAddModalOpen(true);
        }}
      />

      {/* GPS Error Alert (if GPS is denied or unavailable) */}
      {errorMessage && !isSimulating && locationSource !== 'ip' && (
        <div className="relative z-30 px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={startTracking}
              className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
            >
              تلاش مجدد
            </button>
            <button
              type="button"
              onClick={() => toggleSimulation(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition"
            >
              شبیه‌ساز
            </button>
          </div>
        </div>
      )}

      {/* Live In-App Alerts Banner */}
      <AlertBanner alerts={activeAlerts} onDismiss={handleDismissAlert} />

      {/* Map Viewport */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <MapContainer
          userLocation={location}
          isRealPositionAcquired={isRealPositionAcquired}
          locationSource={locationSource}
          destinations={destinations}
          selectedDestination={selectedDestination}
          distances={distances}
          activeRoute={activeRoute}
          onMapClick={handleMapClick}
          onSelectDestination={handleRouteToDestination}
          onEditDestination={handleEditDestination}
          onToggleDestination={handleToggleDestination}
          onDeleteDestination={handleDeleteDestination}
          onAddDestinationToTrip={handleAddDestinationToTrip}
          isSimulating={isSimulating}
          simulationClickMode={simulationClickMode}
          onSimulateMoveUser={(lat, lon) => setSimulatedLocation(lat, lon)}
          onManualSetUserLocation={(lat, lon) => setManualLocation(lat, lon)}
          isAutoFollowing={isAutoFollowing}
          setIsAutoFollowing={setIsAutoFollowing}
        />

        {/* Trip & Route Navigation Panel */}
        <TripRoutePanel
          activeRoute={activeRoute}
          destinations={destinations}
          onAddStopToTrip={handleAddDestinationToTrip}
          onRemoveStopFromTrip={handleRemoveStopFromTrip}
          onMoveStop={handleMoveStop}
          onClearTrip={handleClearTrip}
          onFitRouteBounds={() => {
            // Triggered via bound fitting in MapContainer
            setIsAutoFollowing(false);
          }}
          isAutoFollowing={isAutoFollowing}
          onToggleAutoFollow={() => setIsAutoFollowing((prev) => !prev)}
        />

        {/* GPS Simulation Floating Panel */}
        {isSimulating && (
          <SimulationControls
            userLocation={location}
            onSimulateMoveUser={(lat, lon) => setSimulatedLocation(lat, lon)}
            destinations={destinations}
            onToggleSimulation={toggleSimulation}
            simulationClickMode={simulationClickMode}
            onSetSimulationClickMode={setSimulationClickMode}
          />
        )}
      </main>

      {/* Expandable Bottom Drawer / Sheet */}
      <DestinationList
        destinations={destinations}
        distances={distances}
        selectedDestination={selectedDestination}
        activeRoute={activeRoute}
        onSelectDestination={setSelectedDestination}
        onRouteToDestination={handleRouteToDestination}
        onAddDestinationToTrip={handleAddDestinationToTrip}
        onEditDestination={handleEditDestination}
        onToggleDestination={handleToggleDestination}
        onDeleteDestination={handleDeleteDestination}
        onOpenAddModal={() => {
          setEditingDestination(null);
          setClickedMapCoords(null);
          setIsAddModalOpen(true);
        }}
        isExpanded={isSheetExpanded}
        onToggleExpand={() => setIsSheetExpanded((prev) => !prev)}
      />

      {/* Add / Edit Destination Modal */}
      <AddDestinationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveDestination}
        editingDestination={editingDestination}
        initialCoords={clickedMapCoords}
      />

      {/* PWA Install Instructions Modal */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isIOS={isIOS}
        onTriggerInstall={install}
      />
    </div>
  );
}
