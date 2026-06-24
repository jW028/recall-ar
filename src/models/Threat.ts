export interface Threat {
    threatId: string;
    patientId: string;
    threatType: string;
    detectedTime: string;
    threatStatus: string;
    alertStatus: string;
    alertTime: string;
    acknowledgedTime: string | null;
}