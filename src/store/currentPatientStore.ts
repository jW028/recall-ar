import type { Patient } from '@/models/Patient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Denormalized copy of the selected patient so headers render offline without refetching the list
export interface CurrentPatientSummary {
    patientId: string;
    patientName: string;
    imageUrl: string | null;
}

// Globally selected patient that the caregiver tabs (Home/Training/Memories/Location) operate on
interface CurrentPatientState {
    currentPatientId: string | null;
    currentPatient: CurrentPatientSummary | null;
    setCurrentPatient: (id: string, details?: Omit<CurrentPatientSummary, 'patientId'>) => void;
    // Refreshes the cached name and photo from a freshly loaded patient list
    syncFromList: (patients: Patient[]) => void;
    clear: () => void;
}

export const useCurrentPatientStore = create<CurrentPatientState>()(
    persist(
        (set) => ({
            currentPatientId: null,
            currentPatient: null,
            setCurrentPatient: (id, details) =>
                set((state) => ({
                    currentPatientId: id,
                    // Drop a stale summary when switching without details rather than mislabelling the new patient
                    currentPatient: details
                        ? { patientId: id, ...details }
                        : state.currentPatient?.patientId === id
                          ? state.currentPatient
                          : null,
                })),
            syncFromList: (patients) =>
                set((state) => {
                    if (!state.currentPatientId) return state;
                    const match = patients.find((p) => p.patientId === state.currentPatientId);
                    if (!match) return state;
                    const prev = state.currentPatient;
                    // Skip the write when nothing changed so subscribed headers don't re-render
                    if (
                        prev?.patientId === match.patientId &&
                        prev.patientName === match.patientName &&
                        prev.imageUrl === match.imageUrl
                    ) {
                        return state;
                    }
                    return {
                        ...state,
                        currentPatient: {
                            patientId: match.patientId,
                            patientName: match.patientName,
                            imageUrl: match.imageUrl,
                        },
                    };
                }),
            clear: () => set({ currentPatientId: null, currentPatient: null }),
        }),
        {
            name: 'caregiver-current-patient',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Convenience selector for the selected patient id
export function useCurrentPatientId() {
    return useCurrentPatientStore((s) => s.currentPatientId);
}

// Cached name and photo of the selected patient, null until a list load or a switch supplies them
export function useCurrentPatient() {
    return useCurrentPatientStore((s) => s.currentPatient);
}
