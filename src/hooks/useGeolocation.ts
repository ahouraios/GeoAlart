import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation, GPSState } from '../types';
import { calculateBearing } from '../utils/geo';

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

// Default center: Shahnameh Blvd, Mashhad (from user's screenshot)
const DEFAULT_CENTER: UserLocation = {
  latitude: 36.4678,
  longitude: 59.5020,
  accuracy: 16,
  heading: 45, // pointing North-East along Shahnameh Blvd
  speed: null,
  timestamp: Date.now(),
};

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
  } = options;

  const [location, setLocation] = useState<UserLocation>(() => {
    const saved = localStorage.getItem('geofence_last_location');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          // If legacy Tehran coordinate is saved, migrate to user's real Shahnameh Blvd Mashhad area
          if (Math.abs(parsed.latitude - 35.6997) < 0.05 && Math.abs(parsed.longitude - 51.3380) < 0.05) {
            return DEFAULT_CENTER;
          }
          return parsed;
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_CENTER;
  });

  const [gpsState, setGpsState] = useState<GPSState>('searching');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isRealPositionAcquired, setIsRealPositionAcquired] = useState<boolean>(() => {
    return !!localStorage.getItem('geofence_last_location');
  });
  const [locationSource, setLocationSource] = useState<'gps' | 'network' | 'ip' | 'manual' | 'simulated'>('network');

  // Real-time Compass Sensor Heading (from gyroscope/magnetometer)
  const [compassHeading, setCompassHeading] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const hasAcquiredGpsRef = useRef<boolean>(false);
  const lastLocationRef = useRef<UserLocation>(location);

  useEffect(() => {
    lastLocationRef.current = location;
  }, [location]);

  // Listen to phone physical compass orientation (DeviceOrientation API)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let angle: number | null = null;

      // iOS Safari provides webkitCompassHeading directly (0 is magnetic North)
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        angle = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android / Chrome: alpha is 0 to 360 degrees
        angle = (360 - e.alpha) % 360;
      }

      if (angle !== null && !isNaN(angle)) {
        const rounded = Math.round(angle);
        setCompassHeading(rounded);

        // Update location heading if GPS heading is not active
        setLocation((prev) => {
          if (prev.heading === rounded) return prev;
          // Only overwrite if device is not currently moving fast with GPS heading
          if (prev.speed == null || prev.speed < 1) {
            return { ...prev, heading: rounded };
          }
          return prev;
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    };
  }, []);

  // Attempt IP-based geolocation fallback if browser GPS is unavailable or blocked
  const fetchIpLocation = useCallback(async () => {
    if (hasAcquiredGpsRef.current || isSimulating) return;
    try {
      const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude && !hasAcquiredGpsRef.current) {
          const ipLoc: UserLocation = {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            accuracy: 2000,
            heading: compassHeading ?? 45,
            speed: null,
            timestamp: Date.now(),
          };
          setLocation(ipLoc);
          setIsRealPositionAcquired(true);
          setLocationSource('ip');
          if (gpsState === 'searching') {
            setGpsState('active');
          }
        }
      }
    } catch {
      // ignore
    }
  }, [gpsState, isSimulating, compassHeading]);

  // Main location tracking starter
  const startTracking = useCallback(() => {
    if (isSimulating) return;

    if (!('geolocation' in navigator)) {
      setGpsState('unavailable');
      setErrorMessage('مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.');
      fetchIpLocation();
      return;
    }

    setGpsState('searching');
    setErrorMessage(null);

    // 1. Immediately request fast position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        hasAcquiredGpsRef.current = true;
        const calculatedHeading =
          pos.coords.heading ??
          (lastLocationRef.current
            ? calculateBearing(
                lastLocationRef.current.latitude,
                lastLocationRef.current.longitude,
                pos.coords.latitude,
                pos.coords.longitude
              )
            : null) ??
          compassHeading ??
          45;

        const newLoc: UserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          heading: calculatedHeading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setLocation(newLoc);
        setIsRealPositionAcquired(true);
        setLocationSource('network');
        setGpsState('active');
        setErrorMessage(null);
        localStorage.setItem('geofence_last_location', JSON.stringify(newLoc));
      },
      () => {
        fetchIpLocation();
      },
      {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 30000,
      }
    );

    // 2. Clear any previous watcher
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // 3. Continuous high accuracy satellite tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        hasAcquiredGpsRef.current = true;
        let bearingToUse = pos.coords.heading;

        // If GPS heading is null and user moved > 2 meters, calculate bearing from trajectory
        if (bearingToUse == null && lastLocationRef.current) {
          const latDiff = Math.abs(pos.coords.latitude - lastLocationRef.current.latitude);
          const lonDiff = Math.abs(pos.coords.longitude - lastLocationRef.current.longitude);
          if (latDiff > 0.00002 || lonDiff > 0.00002) {
            bearingToUse = calculateBearing(
              lastLocationRef.current.latitude,
              lastLocationRef.current.longitude,
              pos.coords.latitude,
              pos.coords.longitude
            );
          } else {
            bearingToUse = lastLocationRef.current.heading ?? compassHeading;
          }
        }

        const newLoc: UserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          heading: bearingToUse ?? compassHeading ?? 45,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setLocation(newLoc);
        setIsRealPositionAcquired(true);
        setLocationSource('gps');
        setGpsState('active');
        setErrorMessage(null);
        localStorage.setItem('geofence_last_location', JSON.stringify(newLoc));
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsState('denied');
          setErrorMessage('دسترسی به GPS مسدود است. لطفاً در مرورگر اجازه دسترسی به لوکیشن را فعال کنید.');
          fetchIpLocation();
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsState('unavailable');
          setErrorMessage('سیگنال سخت‌افزاری GPS در دسترس نیست. موقعیت شبکه فعال شد.');
          fetchIpLocation();
        } else if (err.code === err.TIMEOUT) {
          if (!hasAcquiredGpsRef.current) {
            fetchIpLocation();
          }
        }
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [enableHighAccuracy, timeout, maximumAge, isSimulating, fetchIpLocation, compassHeading]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Set location manually (user dragged marker or selected city)
  const setManualLocation = useCallback((lat: number, lon: number, accuracy: number = 10, heading?: number) => {
    const bearing =
      heading ??
      (lastLocationRef.current
        ? calculateBearing(
            lastLocationRef.current.latitude,
            lastLocationRef.current.longitude,
            lat,
            lon
          )
        : null) ??
      compassHeading ??
      45;

    const updated: UserLocation = {
      latitude: lat,
      longitude: lon,
      accuracy,
      heading: bearing,
      speed: 3.5, // gentle test motion
      timestamp: Date.now(),
    };
    setLocation(updated);
    setIsRealPositionAcquired(true);
    setLocationSource('manual');
    setGpsState('active');
    setErrorMessage(null);
    localStorage.setItem('geofence_last_location', JSON.stringify(updated));
  }, [compassHeading]);

  // Update location in simulation mode (automatically calculates road direction)
  const setSimulatedLocation = useCallback((lat: number, lon: number, accuracy: number = 8) => {
    let bearing = 45;
    if (lastLocationRef.current) {
      const b = calculateBearing(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        lat,
        lon
      );
      if (!isNaN(b) && (lat !== lastLocationRef.current.latitude || lon !== lastLocationRef.current.longitude)) {
        bearing = Math.round(b);
      } else {
        bearing = lastLocationRef.current.heading ?? 45;
      }
    }

    const updated: UserLocation = {
      latitude: lat,
      longitude: lon,
      accuracy,
      heading: bearing,
      speed: 6.2, // ~22 km/h
      timestamp: Date.now(),
    };
    setLocation(updated);
    setIsRealPositionAcquired(true);
    setLocationSource('simulated');
    localStorage.setItem('geofence_last_location', JSON.stringify(updated));
  }, []);

  // Toggle simulation mode
  const toggleSimulation = useCallback((enabled?: boolean) => {
    setIsSimulating((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      if (next) {
        stopTracking();
        setIsRealPositionAcquired(true);
        setGpsState('active');
        setErrorMessage(null);
        setLocationSource('simulated');
      } else {
        startTracking();
      }
      return next;
    });
  }, [startTracking, stopTracking]);

  // On mount: start tracking
  useEffect(() => {
    startTracking();
    return () => {
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  return {
    location,
    gpsState,
    errorMessage,
    isSimulating,
    isRealPositionAcquired,
    locationSource,
    compassHeading,
    startTracking,
    setManualLocation,
    setSimulatedLocation,
    toggleSimulation,
  };
}
