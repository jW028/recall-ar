export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      Caregiver: {
        Row: {
          caregiver_contact: string
          caregiver_id: string
          created_at: string
          email: string
          full_name: string
          updated_at: string
        }
        Insert: {
          caregiver_contact: string
          caregiver_id?: string
          created_at?: string
          email: string
          full_name: string
          updated_at?: string
        }
        Update: {
          caregiver_contact?: string
          caregiver_id?: string
          created_at?: string
          email?: string
          full_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      CognitiveReport: {
        Row: {
          generated_date: string
          patient_id: string
          report_data: Json
          report_id: string
        }
        Insert: {
          generated_date?: string
          patient_id: string
          report_data: Json
          report_id?: string
        }
        Update: {
          generated_date?: string
          patient_id?: string
          report_data?: Json
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CognitiveReport_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      ContextAlert: {
        Row: {
          ack_status: string
          ack_time: string | null
          asset_id: string | null
          ctxalert_id: string
          ctxalert_msg: string
          ctxalert_status: string
          ctxalert_time: string
          frequency: string
          patient_id: string
        }
        Insert: {
          ack_status: string
          ack_time?: string | null
          asset_id?: string | null
          ctxalert_id?: string
          ctxalert_msg: string
          ctxalert_status: string
          ctxalert_time?: string
          frequency: string
          patient_id: string
        }
        Update: {
          ack_status?: string
          ack_time?: string | null
          asset_id?: string | null
          ctxalert_id?: string
          ctxalert_msg?: string
          ctxalert_status?: string
          ctxalert_time?: string
          frequency?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ContextAlert_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "MemoryAsset"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "ContextAlert_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      DailyReviewEntry: {
        Row: {
          asset_id: string
          completed: boolean
          is_onboarding: boolean
          patient_id: string
          position: number
          queue_date: string
          review_id: string
        }
        Insert: {
          asset_id: string
          completed?: boolean
          is_onboarding: boolean
          patient_id: string
          position: number
          queue_date: string
          review_id?: string
        }
        Update: {
          asset_id?: string
          completed?: boolean
          is_onboarding?: boolean
          patient_id?: string
          position?: number
          queue_date?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "DailyReviewEntry_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "MemoryAsset"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "DailyReviewEntry_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      Geofence: {
        Row: {
          center_latitude: number
          center_longitude: number
          geofence_id: string
          geofence_type: string
          patient_id: string
          radius_meters: number
        }
        Insert: {
          center_latitude: number
          center_longitude: number
          geofence_id?: string
          geofence_type: string
          patient_id: string
          radius_meters: number
        }
        Update: {
          center_latitude?: number
          center_longitude?: number
          geofence_id?: string
          geofence_type?: string
          patient_id?: string
          radius_meters?: number
        }
        Relationships: [
          {
            foreignKeyName: "Geofence_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      GeofenceEvent: {
        Row: {
          event_time: string
          event_type: string
          geoevent_id: string
          geofence_id: string
        }
        Insert: {
          event_time: string
          event_type: string
          geoevent_id?: string
          geofence_id: string
        }
        Update: {
          event_time?: string
          event_type?: string
          geoevent_id?: string
          geofence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "GeofenceEvent_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "Geofence"
            referencedColumns: ["geofence_id"]
          },
        ]
      }
      MemoryAsset: {
        Row: {
          asset_id: string
          category: string | null
          created_at: string
          current_interval_minutes: number
          date_of_birth: string | null
          embedding: string
          image_url: string
          name: string
          next_review: string
          notes: string
          patient_id: string
          relationship: string | null
          reminder_text: string | null
          review_count: number
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          asset_id?: string
          category?: string | null
          created_at?: string
          current_interval_minutes?: number
          date_of_birth?: string | null
          embedding: string
          image_url: string
          name: string
          next_review: string
          notes: string
          patient_id: string
          relationship?: string | null
          reminder_text?: string | null
          review_count?: number
          status: string
          type: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          category?: string | null
          created_at?: string
          current_interval_minutes?: number
          date_of_birth?: string | null
          embedding?: string
          image_url?: string
          name?: string
          next_review?: string
          notes?: string
          patient_id?: string
          relationship?: string | null
          reminder_text?: string | null
          review_count?: number
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "MemoryAsset_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      Patient: {
        Row: {
          caregiver_id: string
          created_at: string
          date_of_birth: string
          emergency_contact: string
          medical_notes: string | null
          patient_id: string
          patient_name: string
          updated_at: string
        }
        Insert: {
          caregiver_id: string
          created_at?: string
          date_of_birth: string
          emergency_contact: string
          medical_notes?: string | null
          patient_id?: string
          patient_name: string
          updated_at?: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          date_of_birth?: string
          emergency_contact?: string
          medical_notes?: string | null
          patient_id?: string
          patient_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Patient_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
      Threat: {
        Row: {
          acknowledged_time: string | null
          alert_status: string
          alert_time: string
          detected_time: string
          geoevent_id: string
          patient_id: string
          threat_id: string
          threat_status: string
          threat_type: string
          track_id: string
        }
        Insert: {
          acknowledged_time?: string | null
          alert_status: string
          alert_time: string
          detected_time: string
          geoevent_id: string
          patient_id: string
          threat_id?: string
          threat_status: string
          threat_type: string
          track_id: string
        }
        Update: {
          acknowledged_time?: string | null
          alert_status?: string
          alert_time?: string
          detected_time?: string
          geoevent_id?: string
          patient_id?: string
          threat_id?: string
          threat_status?: string
          threat_type?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Threat_geoevent_id_fkey"
            columns: ["geoevent_id"]
            isOneToOne: false
            referencedRelation: "GeofenceEvent"
            referencedColumns: ["geoevent_id"]
          },
          {
            foreignKeyName: "Threat_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      TrainingSession: {
        Row: {
          asset_id: string
          interval_minutes: number
          session_id: string
          success: boolean
          timestamp: string
        }
        Insert: {
          asset_id: string
          interval_minutes: number
          session_id?: string
          success: boolean
          timestamp: string
        }
        Update: {
          asset_id?: string
          interval_minutes?: number
          session_id?: string
          success?: boolean
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "TrainingSession_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "MemoryAsset"
            referencedColumns: ["asset_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
