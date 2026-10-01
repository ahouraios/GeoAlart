import { soundEngine } from './audio';
import { formatDistance } from './geo';
import { Destination, GeofenceZoneState, AlertNotificationItem } from '../types';

export class NotificationManager {
  // Store the state of each destination: last zone state and last alert timestamp
  private zoneStates: Map<string, GeofenceZoneState> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();

  // Minimum time (in milliseconds) before re-triggering the same alert type for the same destination (3 minutes)
  private readonly ALERT_COOLDOWN_MS = 3 * 60 * 1000;

  /**
   * Request browser notification permissions
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Trigger mobile vibration pattern
   */
  public triggerVibration(type: 'warning' | 'arrival') {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'arrival') {
          // Double buzz + long buzz for arrival
          navigator.vibrate([300, 150, 300, 150, 600]);
        } else {
          // Double buzz for proximity warning
          navigator.vibrate([250, 100, 250]);
        }
      } catch {
        // Some mobile browsers restrict vibration without user gesture
      }
    }
  }

  /**
   * Evaluates a destination relative to user distance and triggers alerts if a geofence threshold is crossed.
   * Returns an AlertNotificationItem if an alert was triggered, otherwise null.
   */
  public evaluateDestination(
    destination: Destination,
    distanceMeters: number
  ): AlertNotificationItem | null {
    if (!destination.enabled) {
      this.zoneStates.set(destination.id, 'outside');
      return null;
    }

    const previousState = this.zoneStates.get(destination.id) || 'outside';
    const lastAlertTime = this.lastAlertTimes.get(destination.id) || 0;
    const now = Date.now();

    // Determine current zone
    let currentState: GeofenceZoneState = 'outside';
    if (distanceMeters <= destination.arrivalRadiusMeters) {
      currentState = 'arrived';
    } else if (distanceMeters <= destination.radiusMeters) {
      currentState = 'warning';
    }

    // Save updated zone
    this.zoneStates.set(destination.id, currentState);

    // If still outside, nothing to alert
    if (currentState === 'outside') {
      return null;
    }

    // Check if we should fire an arrival alert
    if (currentState === 'arrived') {
      // Trigger if we just transitioned to arrived, or if cooldown passed
      const shouldTrigger =
        previousState !== 'arrived' || now - lastAlertTime > this.ALERT_COOLDOWN_MS;

      if (shouldTrigger) {
        this.lastAlertTimes.set(destination.id, now);
        this.triggerVibration('arrival');
        soundEngine.playArrivalChime();

        const title = `رسیدن به مقصد: ${destination.name} 🎯`;
        const message = `شما به مقصد "${destination.name}" رسیدید (فاصله: ${formatDistance(distanceMeters)})`;

        this.sendBrowserNotification(title, message, '/icon.svg');

        return {
          id: `alert-${destination.id}-${now}`,
          destinationId: destination.id,
          destinationName: destination.name,
          type: 'arrival',
          distanceMeters,
          message,
          timestamp: now,
        };
      }
      return null;
    }

    // Check if we should fire a proximity warning alert
    if (currentState === 'warning') {
      // Trigger if coming from outside, or if cooldown passed and not arrived
      const shouldTrigger =
        previousState === 'outside' || (previousState === 'warning' && now - lastAlertTime > this.ALERT_COOLDOWN_MS);

      if (shouldTrigger) {
        this.lastAlertTimes.set(destination.id, now);
        this.triggerVibration('warning');
        soundEngine.playProximityChime();

        const title = `هشدار نزدیکی: ${destination.name} 🔔`;
        const message = `شما به محدوده ${formatDistance(destination.radiusMeters)} مقصد "${destination.name}" وارد شدید! فاصله فعلی: ${formatDistance(distanceMeters)}`;

        this.sendBrowserNotification(title, message, '/icon.svg');

        return {
          id: `alert-${destination.id}-${now}`,
          destinationId: destination.id,
          destinationName: destination.name,
          type: 'warning',
          distanceMeters,
          message,
          timestamp: now,
        };
      }
    }

    return null;
  }

  /**
   * Send Web Notification
   */
  private sendBrowserNotification(title: string, body: string, icon: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon,
          badge: icon,
          tag: 'geofence-alert',
          lang: 'fa',
          dir: 'rtl',
        });
      } catch {
        // Fallback for Service Worker notification if in standalone mode
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              icon,
              badge: icon,
              tag: 'geofence-alert',
              dir: 'rtl',
              lang: 'fa',
            });
          }).catch(() => {});
        }
      }
    }
  }

  /**
   * Reset tracking state for a specific destination (e.g. after edit or re-enable)
   */
  public resetDestination(destinationId: string) {
    this.zoneStates.delete(destinationId);
    this.lastAlertTimes.delete(destinationId);
  }
}

export const notificationManager = new NotificationManager();
