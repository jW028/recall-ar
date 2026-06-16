import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import type { Patient } from '@/models/Patient';
import * as Crypto from 'expo-crypto';
import type { SQLiteBindValue } from 'expo-sqlite';


// Types
export interface CreatePatientParams {
    caregiverId: string;
    patientName: string;
    dateOfBirth: string;
    medicalNotes?: string | null;
    emergencyContact: string;
}

export interface UpdatePatientParams {
    patientName?: string;
    dateOfBirth?: string;
    medicalNotes?: string | null;
    emergencyContact?: string;
  }

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}


// Helpers
function mapRowToPatient(row: Record<string, unknown>): Patient {
    return {
        patientId: row.patient_id as string,
        caregiverId: row.caregiver_id as string,
        patientName: row.patient_name as string,
        dateOfBirth: row.date_of_birth as string,
        medicalNotes: row.medical_notes as string | null,
        emergencyContact: row.emergency_contact as string,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

// Queues a write operation for SyncService to push to Supabase
async function queueSync(
    tableName: string,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    ): Promise<void> {
    const db = getDatabase();
    const syncId = Crypto.randomUUID();

    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))`,
        [syncId, tableName, rowId, operation]
    );
}

async function createPatient(
    params: CreatePatientParams
): Promise<ServiceResult<Patient>> {
    if (!params.patientName.trim()) {
        return { data: null, error: 'Name is required' };
    }
    if (!params.dateOfBirth) {
        return { data: null, error: 'Invalid DOB' };
    }
    if (params.medicalNotes && params.medicalNotes.length > 2000) {
        return { data: null, error: 'Medical notes must be under 2000 characters' };
    }

    const db = getDatabase();
    const patientId = Crypto.randomUUID();
    const now = new Date().toISOString();

    try {
        await db.runAsync(
        `INSERT INTO Patient
            (patient_id, caregiver_id, patient_name, date_of_birth, medical_notes, emergency_contact, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            patientId,
            params.caregiverId,
            params.patientName.trim(),
            params.dateOfBirth,
            params.medicalNotes ?? null,
            params.emergencyContact.trim(),
            now,
            now,
        ]
        );
    } catch {
        return { data: null, error: 'Failed to save patient. Please try again.' };
    }

    await queueSync('Patient', patientId, 'INSERT');

    const patient: Patient = {
        patientId,
        caregiverId: params.caregiverId,
        patientName: params.patientName.trim(),
        dateOfBirth: params.dateOfBirth,
        medicalNotes: params.medicalNotes ?? null,
        emergencyContact: params.emergencyContact.trim(),
        createdAt: now,
        updatedAt: now,
    };

    return { data: patient, error: null };
}

// Get patients
async function getPatientsByCaregiver(
    caregiverId: string
): Promise<ServiceResult<Patient[]>> {
    const db = getDatabase();

    try {
        const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM Patient WHERE caregiver_id = ? ORDER BY patient_name ASC`,
        [caregiverId]);
        return { data: rows.map(mapRowToPatient), error: null };
    } catch {
        return { data: null, error: 'Failed to load patients.' };
    }
}

async function getPatientById(
    patientId: string
    ): Promise<ServiceResult<Patient>> {
    const db = getDatabase();

    try {
        const row = await db.getFirstAsync<Record<string, unknown>>(
        `SELECT * FROM Patient WHERE patient_id = ?`,
        [patientId]
        );
        if (!row) {
        return { data: null, error: 'Patient not found.' };
        }
        return { data: mapRowToPatient(row), error: null };
    } catch {
        return { data: null, error: 'Failed to load patient.' };
    }
}


async function updatePatient(
    patientId: string,
    params: UpdatePatientParams
): Promise<ServiceResult<Patient>> {
    if (params.patientName !== undefined && !params.patientName.trim()) {
      return { data: null, error: 'Name is required' };
    }
    if (
      params.medicalNotes !== undefined &&
      params.medicalNotes !== null &&
      params.medicalNotes.length > 2000
    ) {
      return { data: null, error: 'Medical notes must be under 2000 characters' };
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: SQLiteBindValue[] = [];

    if (params.patientName !== undefined) {
      fields.push('patient_name = ?');
      values.push(params.patientName.trim());
    }
    if (params.dateOfBirth !== undefined) {
      fields.push('date_of_birth = ?');
      values.push(params.dateOfBirth);
    }
    if (params.medicalNotes !== undefined) {
      fields.push('medical_notes = ?');
      values.push(params.medicalNotes);
    }
    if (params.emergencyContact !== undefined) {
      fields.push('emergency_contact = ?');
      values.push(params.emergencyContact.trim());
    }

    if (fields.length === 0) {
      return { data: null, error: 'No fields to update.' };
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(patientId);

    try {
      await db.runAsync(
        `UPDATE Patient SET ${fields.join(', ')} WHERE patient_id = ?`,
        values);
    } catch {
      return { data: null, error: 'Failed to update patient. Please try again.' };
    }

    await queueSync('Patient', patientId, 'UPDATE');

    return getPatientById(patientId);
}

async function deletePatient(patientId: string): Promise<ServiceResult> {
    const db = getDatabase();

    try {
      await db.runAsync(`DELETE FROM Patient WHERE patient_id = ?`, [patientId]);
    } catch {
      return { data: null, error: 'Failed to delete patient. Please try again.' };
    }

    await queueSync('Patient', patientId, 'DELETE');

    return { data: null, error: null };
}

// Sync with cloud on first login / new device
async function pullPatientsFromCloud(
    caregiverId: string
  ): Promise<ServiceResult<number>> {
    const { data: rows, error: fetchError } = await supabase
      .from('Patient')
      .select('*')
      .eq('caregiver_id', caregiverId);

    if (fetchError) {
      return { data: null, error: 'Failed to sync patients from cloud.' };
    }

    const db = getDatabase();
    let count = 0;

    await db.withExclusiveTransactionAsync(async () => {
      for (const row of rows ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO Patient
            (patient_id, caregiver_id, patient_name, date_of_birth, medical_notes, emergency_contact, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.patient_id,
            row.caregiver_id,
            row.patient_name,
            row.date_of_birth,
            row.medical_notes,
            row.emergency_contact,
            row.created_at,
            row.updated_at,
          ]
        );
        count++;
      }
    });

    return { data: count, error: null };
}


export const PatientService = {
    createPatient,
    getPatientsByCaregiver,
    getPatientById,
    updatePatient,
    deletePatient,
    pullPatientsFromCloud,
};
