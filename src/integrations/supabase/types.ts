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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_creations: {
        Row: {
          created_at: string
          credits_spent: number
          duration_seconds: number | null
          error_message: string | null
          external_task_id: string | null
          id: string
          items: Json
          kind: string
          options: Json
          prompt: string
          provider_slug: string | null
          published_track_id: string | null
          result_urls: string[]
          status: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          duration_seconds?: number | null
          error_message?: string | null
          external_task_id?: string | null
          id?: string
          items?: Json
          kind: string
          options?: Json
          prompt: string
          provider_slug?: string | null
          published_track_id?: string | null
          result_urls?: string[]
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          duration_seconds?: number | null
          error_message?: string | null
          external_task_id?: string | null
          id?: string
          items?: Json
          kind?: string
          options?: Json
          prompt?: string
          provider_slug?: string | null
          published_track_id?: string | null
          result_urls?: string[]
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_creations_published_track_id_fkey"
            columns: ["published_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          created_at: string
          credit_cost: number
          id: string
          is_active: boolean
          is_default: boolean
          kind: string
          model: string | null
          name: string
          notes: string | null
          secret_name: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          credit_cost?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind: string
          model?: string | null
          name: string
          notes?: string | null
          secret_name?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          credit_cost?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          model?: string | null
          name?: string
          notes?: string | null
          secret_name?: string | null
          slug?: string
        }
        Relationships: []
      }
      ai_stems: {
        Row: {
          created_at: string
          creation_id: string | null
          credits_spent: number
          error_message: string | null
          external_task_id: string | null
          id: string
          item_index: number
          mode: string
          status: string
          stem_name: string | null
          stems: Json
          title: string
          track_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creation_id?: string | null
          credits_spent?: number
          error_message?: string | null
          external_task_id?: string | null
          id?: string
          item_index?: number
          mode: string
          status?: string
          stem_name?: string | null
          stems?: Json
          title: string
          track_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creation_id?: string | null
          credits_spent?: number
          error_message?: string | null
          external_task_id?: string | null
          id?: string
          item_index?: number
          mode?: string
          status?: string
          stem_name?: string | null
          stems?: Json
          title?: string
          track_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_stems_creation_id_fkey"
            columns: ["creation_id"]
            isOneToOne: false
            referencedRelation: "ai_creations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_stems_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          artist_id: string
          cover_key: string | null
          created_at: string
          id: string
          release_date: string | null
          title: string
        }
        Insert: {
          artist_id: string
          cover_key?: string | null
          created_at?: string
          id?: string
          release_date?: string | null
          title: string
        }
        Update: {
          artist_id?: string
          cover_key?: string | null
          created_at?: string
          id?: string
          release_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      app_modules: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      artist_media: {
        Row: {
          artist_id: string
          created_at: string
          creation_id: string | null
          id: string
          is_published: boolean
          kind: string
          thumbnail_url: string | null
          title: string | null
          url: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          creation_id?: string | null
          id?: string
          is_published?: boolean
          kind: string
          thumbnail_url?: string | null
          title?: string | null
          url: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          creation_id?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          thumbnail_url?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_media_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_media_creation_id_fkey"
            columns: ["creation_id"]
            isOneToOne: true
            referencedRelation: "ai_creations"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          avatar_key: string | null
          banner_key: string | null
          bio: string | null
          created_at: string
          id: string
          monthly_listeners: number
          name: string
          owner_id: string | null
          slug: string
          social_links: Json
        }
        Insert: {
          avatar_key?: string | null
          banner_key?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          monthly_listeners?: number
          name: string
          owner_id?: string | null
          slug: string
          social_links?: Json
        }
        Update: {
          avatar_key?: string | null
          banner_key?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          monthly_listeners?: number
          name?: string
          owner_id?: string | null
          slug?: string
          social_links?: Json
        }
        Relationships: []
      }
      credit_balances: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          creation_id: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          creation_id?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          creation_id?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      daw_projects: {
        Row: {
          bpm: number
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bpm?: number
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bpm?: number
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_alerts: {
        Row: {
          last_sent_at: string
          last_value: number | null
          name: string
        }
        Insert: {
          last_sent_at?: string
          last_value?: number | null
          name: string
        }
        Update: {
          last_sent_at?: string
          last_value?: number | null
          name?: string
        }
        Relationships: []
      }
      internal_job_keys: {
        Row: {
          created_at: string
          name: string
          token_sha256: string
        }
        Insert: {
          created_at?: string
          name: string
          token_sha256: string
        }
        Update: {
          created_at?: string
          name?: string
          token_sha256?: string
        }
        Relationships: []
      }
      kie_service_prices: {
        Row: {
          allowed_plans: string[]
          enabled: boolean
          kie_credits: number
          label: string
          service: string
          updated_at: string
          user_credits: number
        }
        Insert: {
          allowed_plans?: string[]
          enabled?: boolean
          kie_credits?: number
          label: string
          service: string
          updated_at?: string
          user_credits: number
        }
        Update: {
          allowed_plans?: string[]
          enabled?: boolean
          kie_credits?: number
          label?: string
          service?: string
          updated_at?: string
          user_credits?: number
        }
        Relationships: []
      }
      kie_tasks: {
        Row: {
          created_at: string
          creation_id: string | null
          credits_spent: number
          error_message: string | null
          external_task_id: string | null
          id: string
          item_index: number
          result: Json
          service: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creation_id?: string | null
          credits_spent?: number
          error_message?: string | null
          external_task_id?: string | null
          id?: string
          item_index?: number
          result?: Json
          service: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creation_id?: string | null
          credits_spent?: number
          error_message?: string | null
          external_task_id?: string | null
          id?: string
          item_index?: number
          result?: Json
          service?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kie_tasks_creation_id_fkey"
            columns: ["creation_id"]
            isOneToOne: false
            referencedRelation: "ai_creations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kie_tasks_service_fkey"
            columns: ["service"]
            isOneToOne: false
            referencedRelation: "kie_service_prices"
            referencedColumns: ["service"]
          },
        ]
      }
      liked_tracks: {
        Row: {
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      lyric_lines: {
        Row: {
          id: string
          text: string
          time_ms: number
          track_id: string
        }
        Insert: {
          id?: string
          text: string
          time_ms: number
          track_id: string
        }
        Update: {
          id?: string
          text?: string
          time_ms?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lyric_lines_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      music_videos: {
        Row: {
          artist_id: string | null
          audio_url: string
          cover_url: string | null
          created_at: string
          creation_id: string
          duration_seconds: number
          id: string
          title: string
          user_id: string
          video_url: string
        }
        Insert: {
          artist_id?: string | null
          audio_url: string
          cover_url?: string | null
          created_at?: string
          creation_id: string
          duration_seconds?: number
          id?: string
          title: string
          user_id: string
          video_url: string
        }
        Update: {
          artist_id?: string | null
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          creation_id?: string
          duration_seconds?: number
          id?: string
          title?: string
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_videos_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_videos_creation_id_fkey"
            columns: ["creation_id"]
            isOneToOne: true
            referencedRelation: "ai_creations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          body: string | null
          created_at: string
          id: string
          link: string | null
          meta: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          meta?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          meta?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          features: string[]
          id: string
          is_active: boolean
          is_highlighted: boolean
          monthly_credits: number
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort: number
          stripe_price_monthly: string | null
          stripe_price_yearly: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          monthly_credits?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          sort?: number
          stripe_price_monthly?: string | null
          stripe_price_yearly?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          monthly_credits?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort?: number
          stripe_price_monthly?: string | null
          stripe_price_yearly?: string | null
        }
        Relationships: []
      }
      play_history: {
        Row: {
          id: string
          played_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_history_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string
          id: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          added_at?: string
          id?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_key: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          is_public: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          cover_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          cover_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_period: string
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      template_uses: {
        Row: {
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_uses_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_comments: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_comments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_events: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          kind: string
          track_id: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          kind: string
          track_id: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          kind?: string
          track_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          album_id: string | null
          artist_id: string
          audio_url: string
          canvas_url: string | null
          comments_count: number
          cover_key: string | null
          created_at: string
          duration_seconds: number
          genre: string | null
          id: string
          is_published: boolean
          likes_count: number
          lyrics: string | null
          plays: number
          prompt: string | null
          shares_count: number
          short_start_seconds: number
          style: string | null
          template_uses: number
          title: string
          trending_score: number
        }
        Insert: {
          album_id?: string | null
          artist_id: string
          audio_url: string
          canvas_url?: string | null
          comments_count?: number
          cover_key?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_published?: boolean
          likes_count?: number
          lyrics?: string | null
          plays?: number
          prompt?: string | null
          shares_count?: number
          short_start_seconds?: number
          style?: string | null
          template_uses?: number
          title: string
          trending_score?: number
        }
        Update: {
          album_id?: string | null
          artist_id?: string
          audio_url?: string
          canvas_url?: string | null
          comments_count?: number
          cover_key?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_published?: boolean
          likes_count?: number
          lyrics?: string | null
          plays?: number
          prompt?: string | null
          shares_count?: number
          short_start_seconds?: number
          style?: string | null
          template_uses?: number
          title?: string
          trending_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_personas: {
        Row: {
          created_at: string
          creation_id: string | null
          description: string | null
          id: string
          kie_persona_id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creation_id?: string | null
          description?: string | null
          id?: string
          kie_persona_id: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          creation_id?: string | null
          description?: string | null
          id?: string
          kie_persona_id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_personas_creation_id_fkey"
            columns: ["creation_id"]
            isOneToOne: false
            referencedRelation: "ai_creations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_playlist: { Args: { _playlist_id: string }; Returns: boolean }
      has_role: { Args: { _role: string }; Returns: boolean }
      is_artist_owner: { Args: { _artist_id: string }; Returns: boolean }
      owns_playlist: { Args: { _playlist_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
