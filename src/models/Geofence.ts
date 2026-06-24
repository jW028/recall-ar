export interface Geofence {
    geofenceId: string,
    patientId: string,
    centerLatitude: number;
    centerLongitude: number;
    radiusMeters: number;
    geofenceType: string;
}