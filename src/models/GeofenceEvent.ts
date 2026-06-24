export interface GeofenceEvent {
    geoEventId: string;
    geofenceId: string;
    eventType: "Enter" | "Exit";
    eventTime: string;
}