import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Globally selected patient that the caregiver tabs (Home/Training/Memories/Location) operate on
interface CurrentPatientState {
    currentPatientId: string | null;
    setCurrentPatient: (id: string) => void;
    clear: () => void;
}

export const useCurrentPatientStore = create<CurrentPatientState>()(
    persist(
        (set) => ({
            currentPatientId: null,
            setCurrentPatient: (id) => set({ currentPatientId: id }),
            clear: () => set({ currentPatientId: null }),
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
