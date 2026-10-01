import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation, GPSState } from '../types';

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const DEFAULT_CENTER: UserLocation = {
  latitude: 35.6997, // Tehran center / Azadi
  longitude: 51.3380,
  accuracy: 15,
  heading: null,
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
    // If we have a saved valid user location, mark as acquired
    return !!localStorage.getItem('geofence_last_location');
  });
  const [locationSource, setLocationSource] = useState<'gps' | 'network' | 'ip' | 'manual' | 'simulated'>('network');

  const watchIdRef = useRef<number | null>(null);
  const hasAcquiredGpsRef = useRef<boolean>(false);

  // Attempt IP-based geolocation fallback if browser GPS is unavailable or taking too long
  const fetchIpLocation = useCallback(async () => {
    if (hasAcquiredGpsRef.current || isSimulating) return;
    try {
      // Free IP geolocation lookup
      const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude && !hasAcquiredGpsRef.current) {
          const ipLoc: UserLocation = {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            accuracy: 2500, // approximate city-level
            heading: null,
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
  }, [gpsState, isSimulating]);

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

    // 1. Immediately request fast position (low accuracy first for instant response)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        hasAcquiredGpsRef.current = true;
        const newLoc: UserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          heading: pos.coords.heading,
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
        // If quick low-accuracy fails, try IP fallback while high-accuracy watcher continues
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

    // 3. Start high accuracy continuous watcher
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        hasAcquiredGpsRef.current = true;
        const newLoc: UserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          heading: pos.coords.heading,
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
          setErrorMessage('دسترسی به GPS در مرورگر مسدود شده است. لطفاً در تنظیمات مرورگر اجازه دسترسی به لوکیشن را فعال کنید.');
          fetchIpLocation();
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsState('unavailable');
          setErrorMessage('سیگنال سخت‌افزاری GPS در دسترس نیست. موقعیت تقریبی شبکه فعال شد.');
          fetchIpLocation();
        } else if (err.code === err.TIMEOUT) {
          // Retry or keep searching
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
  }, [enableHighAccuracy, timeout, maximumAge, isSimulating, fetchIpLocation]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Set location manually (e.g. user dragged marker or tapped to position themselves)
  const setManualLocation = useCallback((lat: number, lon: number, accuracy: number = 10) => {
    const updated: UserLocation = {
      latitude: lat,
      longitude: lon,
      accuracy,
      heading: null,
      speed: null,
      timestamp: Date.now(),
    };
    setLocation(updated);
    setIsRealPositionAcquired(true);
    setLocationSource('manual');
    setGpsState('active');
    setErrorMessage(null);
    localStorage.setItem('geofence_last_location', JSON.stringify(updated));
  }, []);

  // Update location in simulation mode
  const setSimulatedLocation = useCallback((lat: number, lon: number, accuracy: number = 8) => {
    const updated: UserLocation = {
      latitude: lat,
      longitude: lon,
      accuracy,
      heading: null,
      speed: null,
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
    startTracking,
    setManualLocation,
    setSimulatedLocation,
    toggleSimulation,
  };
}
