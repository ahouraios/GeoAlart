import { calculateHaversineDistance, toPersianDigits } from './geo';

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
  source: 'osrm' | 'direct';
}

/**
 * Fetches real driving route from OSRM (Open Source Routing Machine)
 * Supports multi-point routes: [User, Stop1, Stop2, ...]
 * Gracefully falls back to interpolated straight path if OSRM is unavailable.
 */
export async function calculateRoute(points: RoutePoint[]): Promise<RouteResult> {
  if (points.length < 2) {
    return {
      coordinates: points.map((p) => [p.lat, p.lon]),
      distanceMeters: 0,
      durationSeconds: 0,
      source: 'direct',
    };
  }

  // Attempt real road routing via OSRM
  try {
    const coordsStr = points.map((p) => `${p.lon},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM coordinates are [lon, lat], Leaflet needs [lat, lon]
        const leafletCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        return {
          coordinates: leafletCoords,
          distanceMeters: Math.round(route.distance),
          durationSeconds: Math.round(route.duration),
          source: 'osrm',
        };
      }
    }
  } catch {
    // Fall back to direct geodetic path
  }

  // Fallback: direct line with Haversine distance
  let totalDistance = 0;
  const directCoords: [number, number][] = points.map((p) => [p.lat, p.lon]);

  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += calculateHaversineDistance(
      points[i].lat,
      points[i].lon,
      points[i + 1].lat,
      points[i + 1].lon
    );
  }

  // Estimate duration assuming average speed of ~35 km/h in city traffic (9.7 m/s)
  const estimatedSeconds = Math.round(totalDistance / 9.7);

  return {
    coordinates: directCoords,
    distanceMeters: totalDistance,
    durationSeconds: estimatedSeconds,
    source: 'direct',
  };
}

/**
 * Format duration in Persian (e.g. ۱۲ دقیقه، ۱ ساعت و ۱۵ دقیقه)
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return 'لحظه‌ای';
  const minutes = Math.round(seconds / 60);

  if (minutes < 1) {
    return 'کمتر از ۱ دقیقه';
  }

  if (minutes < 60) {
    return `${toPersianDigits(minutes)} دقیقه`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${toPersianDigits(hours)} ساعت`;
  }

  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(remainingMinutes)} دقیقه`;
}
