/**
 * Office Geo-Fencing Configuration for Tech Minds IT Solutions
 */
export const OFFICE_GEO_CONFIG = {
  name: "Tech Minds IT Solutions",
  latitude: 14.450900836380491,
  longitude: 79.98846669999999,
  allowedRadiusMeters: 100,
};

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GPSLocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters: number;
  isWithinRadius: boolean;
};

/**
 * Requests the browser's live GPS location and computes distance to the office.
 */
export function getCurrentLocation(
  targetLat = OFFICE_GEO_CONFIG.latitude,
  targetLng = OFFICE_GEO_CONFIG.longitude,
  allowedRadius = OFFICE_GEO_CONFIG.allowedRadiusMeters
): Promise<GPSLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser. Please use a location-enabled browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const distanceMeters = calculateHaversineDistance(
          latitude,
          longitude,
          targetLat,
          targetLng
        );

        const isWithinRadius = distanceMeters <= allowedRadius;

        resolve({
          latitude,
          longitude,
          accuracy: Math.round(accuracy * 100) / 100,
          distanceMeters: Math.round(distanceMeters * 100) / 100,
          isWithinRadius,
        });
      },
      (error) => {
        let msg = "Failed to retrieve live GPS location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Location permission denied. Please allow GPS location access in your browser to check in.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Location information unavailable. Please check your device GPS settings.";
            break;
          case error.TIMEOUT:
            msg = "Location request timed out. Please check your GPS signal and try again.";
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
