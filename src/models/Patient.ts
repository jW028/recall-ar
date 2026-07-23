export interface Patient {
    patientId: string,
    caregiverId: string,
    patientName: string,
    dateOfBirth: string,
    medicalNotes: string | null,
    emergencyContact: string,
    imageUrl: string | null,
    createdAt: string,
    updatedAt: string,
}