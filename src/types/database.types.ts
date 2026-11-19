// Типи бази даних GainStep у форматі `supabase gen types typescript`.
// Після підключення проєкту перегенеруй командою:
//   npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      body_weight_entries: {
        Row: {
          created_at: string
          id: string
          recorded_on: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          recorded_on?: string
          user_id?: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          recorded_on?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          id: string
          image_path: string | null
          is_compound: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          name_uk: string | null
          owner_id: string | null
          weight_increment: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          id?: string
          image_path?: string | null
          is_compound?: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          name_uk?: string | null
          owner_id?: string | null
          weight_increment?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          equipment?: Database["public"]["Enums"]["equipment_type"]
          id?: string
          image_path?: string | null
          is_compound?: boolean
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name?: string
          name_uk?: string | null
          owner_id?: string | null
          weight_increment?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_program_id: string | null
          created_at: string
          display_name: string | null
          experience: Database["public"]["Enums"]["experience_level"] | null
          goal: Database["public"]["Enums"]["training_goal"] | null
          id: string
          locale: string
          min_rest_seconds: number
          onboarded_at: string | null
          unit: Database["public"]["Enums"]["weight_unit"]
          updated_at: string
        }
        Insert: {
          active_program_id?: string | null
          created_at?: string
          display_name?: string | null
          experience?: Database["public"]["Enums"]["experience_level"] | null
          goal?: Database["public"]["Enums"]["training_goal"] | null
          id: string
          locale?: string
          min_rest_seconds?: number
          onboarded_at?: string | null
          unit?: Database["public"]["Enums"]["weight_unit"]
          updated_at?: string
        }
        Update: {
          active_program_id?: string | null
          created_at?: string
          display_name?: string | null
          experience?: Database["public"]["Enums"]["experience_level"] | null
          goal?: Database["public"]["Enums"]["training_goal"] | null
          id?: string
          locale?: string
          min_rest_seconds?: number
          onboarded_at?: string | null
          unit?: Database["public"]["Enums"]["weight_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_program_id_fkey"
            columns: ["active_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_days: {
        Row: {
          id: string
          name: string
          name_uk: string | null
          position: number
          program_id: string
        }
        Insert: {
          id?: string
          name: string
          name_uk?: string | null
          position: number
          program_id: string
        }
        Update: {
          id?: string
          name?: string
          name_uk?: string | null
          position?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_exercises: {
        Row: {
          exercise_id: string
          id: string
          position: number
          program_day_id: string
          rep_max: number
          rep_min: number
          rest_seconds: number
          target_sets: number
        }
        Insert: {
          exercise_id: string
          id?: string
          position: number
          program_day_id: string
          rep_max?: number
          rep_min?: number
          rest_seconds?: number
          target_sets?: number
        }
        Update: {
          exercise_id?: string
          id?: string
          position?: number
          program_day_id?: string
          rep_max?: number
          rep_min?: number
          rest_seconds?: number
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_exercises_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          days_per_week: number
          description: string | null
          description_uk: string | null
          id: string
          image_path: string | null
          level: Database["public"]["Enums"]["experience_level"] | null
          name: string
          name_uk: string | null
          owner_id: string | null
          source_template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_per_week: number
          description?: string | null
          description_uk?: string | null
          id?: string
          image_path?: string | null
          level?: Database["public"]["Enums"]["experience_level"] | null
          name: string
          name_uk?: string | null
          owner_id?: string | null
          source_template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_per_week?: number
          description?: string | null
          description_uk?: string | null
          id?: string
          image_path?: string | null
          level?: Database["public"]["Enums"]["experience_level"] | null
          name?: string
          name_uk?: string | null
          owner_id?: string | null
          source_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed_at: string | null
          exercise_id: string
          exercise_position: number
          id: string
          is_completed: boolean
          reps: number
          set_number: number
          weight: number
          workout_id: string
        }
        Insert: {
          completed_at?: string | null
          exercise_id: string
          exercise_position: number
          id?: string
          is_completed?: boolean
          reps: number
          set_number: number
          weight: number
          workout_id: string
        }
        Update: {
          completed_at?: string | null
          exercise_id?: string
          exercise_position?: number
          id?: string
          is_completed?: boolean
          reps?: number
          set_number?: number
          weight?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          name: string
          notes: string | null
          program_day_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["workout_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          name: string
          notes?: string | null
          program_day_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workout_status"]
          user_id?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          program_day_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workout_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clone_program: {
        Args: { p_locale?: string; template_id: string }
        Returns: string
      }
      delete_my_account: {
        Args: never
        Returns: undefined
      }
      save_program: {
        Args: { p_program_id: string; p_payload: Json }
        Returns: undefined
      }
      save_workout_sets: {
        Args: {
          p_notes: string
          p_sets: Json
          p_started_at: string
          p_workout_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      equipment_type:
        | "barbell"
        | "dumbbell"
        | "machine"
        | "cable"
        | "bodyweight"
        | "kettlebell"
      experience_level: "beginner" | "intermediate"
      muscle_group:
        | "chest"
        | "back"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "core"
      training_goal: "strength" | "hypertrophy"
      weight_unit: "kg" | "lb"
      workout_status: "in_progress" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

// Короткі помічники: Tables<"workouts">, TablesInsert<"workout_sets">, Enums<"muscle_group">
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]