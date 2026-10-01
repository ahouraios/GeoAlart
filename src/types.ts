export interface Destination {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // Warning radius (e.g., 200, 500, 1000)
  arrivalRadiusMeters: number; // Final arrival threshold (typically 50m)
  color: string; // Hex color for marker & geofence circle
  category: 'home' | 'work' | 'shopping' | 'travel' | 'personal' | 'other';
  enabled: boolean;
  createdAt: number;
}

export type GeofenceZoneState = 'outside' | 'warning' | 'arrived';

export interface DestinationStatus {
  destinationId: string;
  distanceMeters: number;
  formattedDistance: string;
  zoneState: GeofenceZoneState;
  lastAlertTimestamp: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface AlertNotificationItem {
  id: string;
  destinationId: string;
  destinationName: string;
  type: 'warning' | 'arrival';
  distanceMeters: number;
  message: string;
  timestamp: number;
}

export type GPSState = 'idle' | 'searching' | 'active' | 'denied' | 'unavailable';

export interface TripStop {
  id: string; // destination id
  name: string;
  latitude: number;
  longitude: number;
  color: string;
  radiusMeters: number;
  arrivalRadiusMeters: number;
  isReached?: boolean;
}

export interface ActiveRoute {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number; // total trip distance
  durationSeconds: number; // total trip duration
  stops: TripStop[]; // ordered list of destinations in this journey
  activeStopIndex: number; // which stop is currently active/targeted (0-indexed)
  source: 'osrm' | 'direct';
  isLoading: boolean;
  error?: string | null;
}
