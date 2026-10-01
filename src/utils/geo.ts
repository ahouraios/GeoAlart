/**
 * Haversine formula to calculate the great-circle distance between two points on the Earth
 * @returns distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Converts English digits to Persian digits
 */
export function toPersianDigits(num: number | string): string {
  const idMap: { [key: string]: string } = {
    '0': '۰',
    '1': '۱',
    '2': '۲',
    '3': '۳',
    '4': '۴',
    '5': '۵',
    '6': '۶',
    '7': '۷',
    '8': '۸',
    '9': '۹',
  };
  return String(num).replace(/[0-9]/g, (w) => idMap[w] || w);
}

/**
 * Formats distance in meters or kilometers with Persian unit labels
 */
export function formatDistance(meters: number): string {
  if (isNaN(meters) || meters < 0) return 'نامشخص';
  if (meters < 1000) {
    return `${toPersianDigits(meters)} متر`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${toPersianDigits(km)} کیلومتر`;
}

/**
 * Calculates initial bearing from point A to point B in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Search locations via OpenStreetMap Nominatim
 */
export async function searchNominatim(query: string): Promise<Array<{
  name: string;
  lat: number;
  lon: number;
  displayName: string;
}>> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&addressdetails=1&limit=5&accept-language=fa,en`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'fa,en',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: { display_name: string; lat: string; lon: string }) => ({
      name: item.display_name.split(',')[0] || item.display_name,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}
