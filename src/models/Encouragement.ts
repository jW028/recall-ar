// One caregiver-to-patient encouragement message. Pending until ack_time is set by the patient's dismissal.
export interface Encouragement {
    encouragementId: string;
    patientId: string;
    caregiverId: string;
    message: string;
    emoji: string | null;
    createdAt: string;
    ackTime: string | null;
    updatedAt: string;
}
