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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json
          id: number
          succeeded: boolean
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json
          id?: number
          succeeded?: boolean
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json
          id?: number
          succeeded?: boolean
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      Caregiver: {
        Row: {
          caregiver_contact: string
          caregiver_id: string
          created_at: string
          email: string
          full_name: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          caregiver_contact: string
          caregiver_id?: string
          created_at?: string
          email: string
          full_name: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          caregiver_contact?: string
          caregiver_id?: string
          created_at?: string
          email?: string
          full_name?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      caregiver_note: {
        Row: {
          author_user_id: string
          body: string
          caregiver_id: string
          created_at: string
          note_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          caregiver_id: string
          created_at?: string
          note_id?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          caregiver_id?: string
          created_at?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_note_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "caregiver_note_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
      caregiver_tag: {
        Row: {
          caregiver_id: string
          created_at: string
          created_by: string
          tag: string
        }
        Insert: {
          caregiver_id: string
          created_at?: string
          created_by: string
          tag: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          created_by?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_tag_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "caregiver_tag_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
      CaregiverPushToken: {
        Row: {
          caregiver_id: string
          push_token: string
          updated_at: string | null
        }
        Insert: {
          caregiver_id: string
          push_token: string
          updated_at?: string | null
        }
        Update: {
          caregiver_id?: string
          push_token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "CaregiverPushToken_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: true
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "CaregiverPushToken_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: true
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
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
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
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
          ctxalert_desc: string | null
          ctxalert_id: string
          ctxalert_msg: string
          ctxalert_status: string
          ctxalert_time: string
          ctxalert_type: string | null
          frequency: string
          patient_id: string
        }
        Insert: {
          ack_status: string
          ack_time?: string | null
          asset_id?: string | null
          ctxalert_desc?: string | null
          ctxalert_id?: string
          ctxalert_msg: string
          ctxalert_status: string
          ctxalert_time?: string
          ctxalert_type?: string | null
          frequency: string
          patient_id: string
        }
        Update: {
          ack_status?: string
          ack_time?: string | null
          asset_id?: string | null
          ctxalert_desc?: string | null
          ctxalert_id?: string
          ctxalert_msg?: string
          ctxalert_status?: string
          ctxalert_time?: string
          ctxalert_type?: string | null
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
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
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
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
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
      DevicePairing: {
        Row: {
          caregiver_id: string
          created_at: string
          device_label: string | null
          expires_at: string
          pairing_id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          caregiver_id: string
          created_at?: string
          device_label?: string | null
          expires_at: string
          pairing_id?: string
          patient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          device_label?: string | null
          expires_at?: string
          pairing_id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "DevicePairing_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "DevicePairing_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "DevicePairing_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "DevicePairing_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      Encouragement: {
        Row: {
          ack_time: string | null
          caregiver_id: string
          created_at: string
          emoji: string | null
          encouragement_id: string
          message: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          ack_time?: string | null
          caregiver_id: string
          created_at: string
          emoji?: string | null
          encouragement_id: string
          message: string
          patient_id: string
          updated_at: string
        }
        Update: {
          ack_time?: string | null
          caregiver_id?: string
          created_at?: string
          emoji?: string | null
          encouragement_id?: string
          message?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Encouragement_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "Encouragement_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "Encouragement_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "Encouragement_patient_id_fkey"
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
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
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
          embedding_model: string | null
          image_url: string
          name: string
          next_review: string
          notes: string
          patient_id: string
          paused_from: string | null
          photo_urls: Json | null
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
          embedding_model?: string | null
          image_url: string
          name: string
          next_review: string
          notes: string
          patient_id: string
          paused_from?: string | null
          photo_urls?: Json | null
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
          embedding_model?: string | null
          image_url?: string
          name?: string
          next_review?: string
          notes?: string
          patient_id?: string
          paused_from?: string | null
          photo_urls?: Json | null
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
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
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
          auth_user_id: string | null
          caregiver_id: string
          created_at: string
          date_of_birth: string
          emergency_contact: string
          image_url: string | null
          medical_notes: string | null
          patient_id: string
          patient_name: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          caregiver_id: string
          created_at?: string
          date_of_birth: string
          emergency_contact: string
          image_url?: string | null
          medical_notes?: string | null
          patient_id?: string
          patient_name: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          caregiver_id?: string
          created_at?: string
          date_of_birth?: string
          emergency_contact?: string
          image_url?: string | null
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
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "Patient_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
      PatientLocation: {
        Row: {
          accuracy: number | null
          latitude: number
          location_id: string
          longitude: number
          patient_id: string
          recorded_at: string
        }
        Insert: {
          accuracy?: number | null
          latitude: number
          location_id?: string
          longitude: number
          patient_id: string
          recorded_at?: string
        }
        Update: {
          accuracy?: number | null
          latitude?: number
          location_id?: string
          longitude?: number
          patient_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patientlocation_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patientlocation_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      RecognitionEvent: {
        Row: {
          asset_id: string
          event_date: string
          event_time: string
          patient_id: string
          recognition_id: string
        }
        Insert: {
          asset_id: string
          event_date: string
          event_time: string
          patient_id: string
          recognition_id: string
        }
        Update: {
          asset_id?: string
          event_date?: string
          event_time?: string
          patient_id?: string
          recognition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "RecognitionEvent_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "MemoryAsset"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "RecognitionEvent_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "RecognitionEvent_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      support_ticket_admin_state: {
        Row: {
          admin_last_read_at: string | null
          assigned_to: string | null
          ticket_id: string
        }
        Insert: {
          admin_last_read_at?: string | null
          assigned_to?: string | null
          ticket_id: string
        }
        Update: {
          admin_last_read_at?: string | null
          assigned_to?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_admin_state_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "admin_support_overview"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "support_ticket_admin_state_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "SupportTicket"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      SupportMessage: {
        Row: {
          author_role: string
          author_user_id: string
          body: string
          created_at: string
          message_id: string
          ticket_id: string
        }
        Insert: {
          author_role: string
          author_user_id: string
          body: string
          created_at?: string
          message_id?: string
          ticket_id: string
        }
        Update: {
          author_role?: string
          author_user_id?: string
          body?: string
          created_at?: string
          message_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "SupportMessage_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "admin_support_overview"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "SupportMessage_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "SupportTicket"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      SupportTicket: {
        Row: {
          caregiver_id: string
          caregiver_last_read_at: string | null
          created_at: string
          diagnostics: Json
          last_message_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          caregiver_id: string
          caregiver_last_read_at?: string | null
          created_at?: string
          diagnostics?: Json
          last_message_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          ticket_id?: string
          updated_at?: string
        }
        Update: {
          caregiver_id?: string
          caregiver_last_read_at?: string | null
          created_at?: string
          diagnostics?: Json
          last_message_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "SupportTicket_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "SupportTicket_caregiver_id_fkey"
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
          patient_id: string
          threat_id: string
          threat_status: string
          threat_type: string
        }
        Insert: {
          acknowledged_time?: string | null
          alert_status: string
          alert_time: string
          detected_time: string
          patient_id: string
          threat_id?: string
          threat_status: string
          threat_type: string
        }
        Update: {
          acknowledged_time?: string | null
          alert_status?: string
          alert_time?: string
          detected_time?: string
          patient_id?: string
          threat_id?: string
          threat_status?: string
          threat_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "Threat_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
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
          response_latency_ms: number | null
          session_id: string
          success: boolean
          timestamp: string
        }
        Insert: {
          asset_id: string
          interval_minutes: number
          response_latency_ms?: number | null
          session_id?: string
          success: boolean
          timestamp: string
        }
        Update: {
          asset_id?: string
          interval_minutes?: number
          response_latency_ms?: number | null
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
      admin_asset_stats: {
        Row: {
          active_pool_size: number | null
          caregiver_id: string | null
          maintenance_count: number | null
          missing_embedding_count: number | null
          object_count: number | null
          onboarding_count: number | null
          patient_id: string | null
          patient_name: string | null
          paused_count: number | null
          person_count: number | null
          pool_utilisation_pct: number | null
          total_assets: number | null
        }
        Relationships: [
          {
            foreignKeyName: "MemoryAsset_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "MemoryAsset_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "Patient_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "Patient_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
      admin_caregiver_overview: {
        Row: {
          asset_count: number | null
          caregiver_contact: string | null
          caregiver_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          image_url: string | null
          last_session_at: string | null
          open_ticket_count: number | null
          paired_patient_count: number | null
          patient_count: number | null
          session_count: number | null
        }
        Relationships: []
      }
      admin_embedding_model_mix: {
        Row: {
          asset_count: number | null
          embedding_model: string | null
          type: string | null
        }
        Relationships: []
      }
      admin_growth_daily: {
        Row: {
          active_patients: number | null
          day: string | null
          new_caregivers: number | null
          new_patients: number | null
          recognitions: number | null
          sessions: number | null
        }
        Relationships: []
      }
      admin_incident_feed: {
        Row: {
          ack_latency_seconds: number | null
          acknowledged_at: string | null
          kind: string | null
          message: string | null
          occurred_at: string | null
          patient_id: string | null
          source_id: string | null
          status: string | null
          subtype: string | null
        }
        Relationships: []
      }
      admin_kpi: {
        Row: {
          assets: number | null
          caregivers: number | null
          open_context_alerts: number | null
          open_threats: number | null
          paired_patients: number | null
          patients: number | null
          recognitions: number | null
          reports_generated: number | null
          sessions: number | null
        }
        Relationships: []
      }
      admin_pairing_funnel: {
        Row: {
          expired_unused: number | null
          issued: number | null
          pending: number | null
          used: number | null
        }
        Relationships: []
      }
      admin_patient_daily: {
        Row: {
          accuracy: number | null
          correct: number | null
          day: string | null
          median_latency_ms: number | null
          patient_id: string | null
          sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "MemoryAsset_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "admin_patient_overview"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "MemoryAsset_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "Patient"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      admin_patient_overview: {
        Row: {
          asset_count: number | null
          auth_user_id: string | null
          caregiver_email: string | null
          caregiver_id: string | null
          caregiver_name: string | null
          completed_30d: number | null
          created_at: string | null
          date_of_birth: string | null
          image_url: string | null
          is_paired: boolean | null
          last_active_day: string | null
          last_session_at: string | null
          maintenance_count: number | null
          onboarding_count: number | null
          open_threats: number | null
          patient_id: string | null
          patient_name: string | null
          paused_count: number | null
          queued_30d: number | null
          sessions_correct: number | null
          sessions_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Patient_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "Patient_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
      admin_support_overview: {
        Row: {
          admin_last_read_at: string | null
          assigned_to: string | null
          caregiver_email: string | null
          caregiver_id: string | null
          caregiver_name: string | null
          created_at: string | null
          diagnostics: Json | null
          has_unread: boolean | null
          last_author_role: string | null
          last_message_at: string | null
          message_count: number | null
          resolved_at: string | null
          status: string | null
          subject: string | null
          ticket_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "SupportTicket_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "admin_caregiver_overview"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "SupportTicket_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "Caregiver"
            referencedColumns: ["caregiver_id"]
          },
        ]
      }
    }
    Functions: {
      admin_auth_user_status: {
        Args: never
        Returns: {
          banned_until: string
          created_at: string
          email: string
          email_confirmed_at: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
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
