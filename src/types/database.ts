// Generated from supabase/schema.sql + supabase/003_hardening.sql with `supabase gen types typescript`.
// Do not edit by hand. Regenerate after every migration (see package.json "db:types").
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string;
          error: string | null;
          feature: string;
          id: number;
          input_tokens: number;
          model: string | null;
          ok: boolean;
          output_tokens: number;
          ref_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error?: string | null;
          feature: string;
          id?: never;
          input_tokens?: number;
          model?: string | null;
          ok?: boolean;
          output_tokens?: number;
          ref_id?: string | null;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          feature?: string;
          id?: never;
          input_tokens?: number;
          model?: string | null;
          ok?: boolean;
          output_tokens?: number;
          ref_id?: string | null;
        };
        Relationships: [];
      };
      article_colors: {
        Row: {
          article_id: string;
          code: string;
          hex: string;
          id: string;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          article_id: string;
          code: string;
          hex: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          article_id?: string;
          code?: string;
          hex?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "article_colors_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_colors_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      article_images: {
        Row: {
          article_id: string;
          blur_data_url: string | null;
          color_id: string | null;
          created_at: string;
          height: number | null;
          id: string;
          medium_url: string;
          sort_order: number;
          thumb_url: string;
          url: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          article_id: string;
          blur_data_url?: string | null;
          color_id?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          medium_url: string;
          sort_order?: number;
          thumb_url: string;
          url: string;
          width?: number | null;
        };
        Update: {
          article_id?: string;
          blur_data_url?: string | null;
          color_id?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          medium_url?: string;
          sort_order?: number;
          thumb_url?: string;
          url?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "article_images_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_images_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_images_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "article_colors";
            referencedColumns: ["id"];
          },
        ];
      };
      articles: {
        Row: {
          brand_id: string;
          category: Database["public"]["Enums"]["article_category"];
          code: string;
          created_at: string;
          description: string | null;
          fabric: string | null;
          garment: string;
          hsn_code: string | null;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          is_public: boolean;
          lot_size: number | null;
          moq: number;
          name: string;
          pattern: string | null;
          source: Database["public"]["Enums"]["article_source"];
          style: string | null;
          updated_at: string;
          wholesale_price: number | null;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          category: Database["public"]["Enums"]["article_category"];
          code: string;
          created_at?: string;
          description?: string | null;
          fabric?: string | null;
          garment: string;
          hsn_code?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          is_public?: boolean;
          lot_size?: number | null;
          moq?: number;
          name: string;
          pattern?: string | null;
          source?: Database["public"]["Enums"]["article_source"];
          style?: string | null;
          updated_at?: string;
          wholesale_price?: number | null;
        };
        Update: {
          brand_id?: string;
          category?: Database["public"]["Enums"]["article_category"];
          code?: string;
          created_at?: string;
          description?: string | null;
          fabric?: string | null;
          garment?: string;
          hsn_code?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          is_public?: boolean;
          lot_size?: number | null;
          moq?: number;
          name?: string;
          pattern?: string | null;
          source?: Database["public"]["Enums"]["article_source"];
          style?: string | null;
          updated_at?: string;
          wholesale_price?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "articles_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          changed_at: string;
          changed_by: string | null;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          row_id: string | null;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          changed_at?: string;
          changed_by?: string | null;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          row_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          changed_at?: string;
          changed_by?: string | null;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          row_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      batches: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          notes: string | null;
          produced_on: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          produced_on?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          produced_on?: string;
        };
        Relationships: [];
      };
      bill_items: {
        Row: {
          amount: number | null;
          bill_id: string;
          created_at: string;
          extracted_color: string | null;
          extracted_name: string | null;
          extracted_size: string | null;
          id: string;
          match_confidence: number | null;
          match_method: string | null;
          qty: number;
          rate: number | null;
          raw_text: string | null;
          variant_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount?: number | null;
          bill_id: string;
          created_at?: string;
          extracted_color?: string | null;
          extracted_name?: string | null;
          extracted_size?: string | null;
          id?: string;
          match_confidence?: number | null;
          match_method?: string | null;
          qty: number;
          rate?: number | null;
          raw_text?: string | null;
          variant_id?: string | null;
        };
        Update: {
          amount?: number | null;
          bill_id?: string;
          created_at?: string;
          extracted_color?: string | null;
          extracted_name?: string | null;
          extracted_size?: string | null;
          id?: string;
          match_confidence?: number | null;
          match_method?: string | null;
          qty?: number;
          rate?: number | null;
          raw_text?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bill_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_scan_jobs: {
        Row: {
          attempts: number;
          batch_ref: string;
          bill_id: string | null;
          created_at: string;
          created_by: string | null;
          error: string | null;
          file_hash: string | null;
          file_name: string | null;
          file_path: string;
          file_size: number | null;
          finished_at: string | null;
          id: string;
          mime_type: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["scan_status"];
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          batch_ref: string;
          bill_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          file_hash?: string | null;
          file_name?: string | null;
          file_path: string;
          file_size?: number | null;
          finished_at?: string | null;
          id?: string;
          mime_type?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["scan_status"];
        };
        Update: {
          attempts?: number;
          batch_ref?: string;
          bill_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          file_hash?: string | null;
          file_name?: string | null;
          file_path?: string;
          file_size?: number | null;
          finished_at?: string | null;
          id?: string;
          mime_type?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["scan_status"];
        };
        Relationships: [
          {
            foreignKeyName: "bill_scan_jobs_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      bills: {
        Row: {
          applied_at: string | null;
          applied_by: string | null;
          bill_date: string | null;
          bill_number: string | null;
          buyer_name_raw: string | null;
          contact_id: string | null;
          created_at: string;
          extracted_json: Json | null;
          file_hash: string | null;
          file_path: string | null;
          id: string;
          status: Database["public"]["Enums"]["bill_status"];
          total_amount: number | null;
          undone_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          applied_at?: string | null;
          applied_by?: string | null;
          bill_date?: string | null;
          bill_number?: string | null;
          buyer_name_raw?: string | null;
          contact_id?: string | null;
          created_at?: string;
          extracted_json?: Json | null;
          file_hash?: string | null;
          file_path?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["bill_status"];
          total_amount?: number | null;
          undone_at?: string | null;
        };
        Update: {
          applied_at?: string | null;
          applied_by?: string | null;
          bill_date?: string | null;
          bill_number?: string | null;
          buyer_name_raw?: string | null;
          contact_id?: string | null;
          created_at?: string;
          extracted_json?: Json | null;
          file_hash?: string | null;
          file_path?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["bill_status"];
          total_amount?: number | null;
          undone_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bills_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          created_at: string;
          id: string;
          is_public: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_public?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_public?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_settings: {
        Row: {
          address: string | null;
          ai_daily_token_budget: number;
          ai_paused: boolean;
          alert_email: string | null;
          business_name: string;
          city: string | null;
          email: string | null;
          established_year: number | null;
          facebook: string | null;
          gstin: string | null;
          id: boolean;
          instagram: string | null;
          phone: string | null;
          tagline: string;
          updated_at: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          ai_daily_token_budget?: number;
          ai_paused?: boolean;
          alert_email?: string | null;
          business_name?: string;
          city?: string | null;
          email?: string | null;
          established_year?: number | null;
          facebook?: string | null;
          gstin?: string | null;
          id?: boolean;
          instagram?: string | null;
          phone?: string | null;
          tagline?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          ai_daily_token_budget?: number;
          ai_paused?: boolean;
          alert_email?: string | null;
          business_name?: string;
          city?: string | null;
          email?: string | null;
          established_year?: number | null;
          facebook?: string | null;
          gstin?: string | null;
          id?: boolean;
          instagram?: string | null;
          phone?: string | null;
          tagline?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          image_path: string | null;
          role: string;
          session_id: string;
          visitor_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          role: string;
          session_id: string;
          visitor_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          role?: string;
          session_id?: string;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "chat_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_sessions: {
        Row: {
          article_id: string | null;
          flagged: boolean;
          id: string;
          owner_note: string | null;
          started_at: string;
          visitor_id: string;
        };
        ComputedFields: never;
        Insert: {
          article_id?: string | null;
          flagged?: boolean;
          id?: string;
          owner_note?: string | null;
          started_at?: string;
          visitor_id: string;
        };
        Update: {
          article_id?: string | null;
          flagged?: boolean;
          id?: string;
          owner_note?: string | null;
          started_at?: string;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_sessions_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_sessions_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_sessions_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          business_name: string | null;
          city: string | null;
          created_at: string;
          credit_limit: number | null;
          email: string | null;
          gstin: string | null;
          id: string;
          instagram: string | null;
          is_active: boolean;
          name: string;
          notes: string | null;
          payment_terms_days: number | null;
          phone: string | null;
          roles: Database["public"]["Enums"]["contact_role"][];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_name?: string | null;
          city?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          instagram?: string | null;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          payment_terms_days?: number | null;
          phone?: string | null;
          roles?: Database["public"]["Enums"]["contact_role"][];
          updated_at?: string;
        };
        Update: {
          business_name?: string | null;
          city?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          instagram?: string | null;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          payment_terms_days?: number | null;
          phone?: string | null;
          roles?: Database["public"]["Enums"]["contact_role"][];
          updated_at?: string;
        };
        Relationships: [];
      };
      faq_entries: {
        Row: {
          answer: string;
          id: string;
          is_active: boolean;
          question: string;
          sort_order: number;
          topic: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          answer: string;
          id?: string;
          is_active?: boolean;
          question: string;
          sort_order?: number;
          topic?: string | null;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          id?: string;
          is_active?: boolean;
          question?: string;
          sort_order?: number;
          topic?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      inbox_items: {
        Row: {
          article_id: string | null;
          created_at: string;
          handled_at: string | null;
          handled_by: string | null;
          handled_note: string | null;
          handled_via: Database["public"]["Enums"]["inbox_via"] | null;
          id: string;
          kind: Database["public"]["Enums"]["inbox_kind"];
          lead_id: string | null;
          meta: NonNullable<Json>;
          name: string | null;
          phone: string | null;
          preview: string | null;
          status: Database["public"]["Enums"]["inbox_status"];
          visitor_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          article_id?: string | null;
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          handled_note?: string | null;
          handled_via?: Database["public"]["Enums"]["inbox_via"] | null;
          id?: string;
          kind: Database["public"]["Enums"]["inbox_kind"];
          lead_id?: string | null;
          meta?: NonNullable<Json>;
          name?: string | null;
          phone?: string | null;
          preview?: string | null;
          status?: Database["public"]["Enums"]["inbox_status"];
          visitor_id?: string | null;
        };
        Update: {
          article_id?: string | null;
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          handled_note?: string | null;
          handled_via?: Database["public"]["Enums"]["inbox_via"] | null;
          id?: string;
          kind?: Database["public"]["Enums"]["inbox_kind"];
          lead_id?: string | null;
          meta?: NonNullable<Json>;
          name?: string | null;
          phone?: string | null;
          preview?: string | null;
          status?: Database["public"]["Enums"]["inbox_status"];
          visitor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inbox_items_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inbox_items_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inbox_items_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inbox_items_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      item_aliases: {
        Row: {
          alias_norm: string;
          article_id: string;
          color_id: string | null;
          created_at: string;
          id: string;
          size: string | null;
        };
        ComputedFields: never;
        Insert: {
          alias_norm: string;
          article_id: string;
          color_id?: string | null;
          created_at?: string;
          id?: string;
          size?: string | null;
        };
        Update: {
          alias_norm?: string;
          article_id?: string;
          color_id?: string | null;
          created_at?: string;
          id?: string;
          size?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "item_aliases_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_aliases_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_aliases_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "article_colors";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_activities: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["activity_kind"];
          lead_id: string;
          meta: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["activity_kind"];
          lead_id: string;
          meta?: NonNullable<Json>;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["activity_kind"];
          lead_id?: string;
          meta?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_items: {
        Row: {
          article_id: string;
          color_id: string | null;
          created_at: string;
          id: string;
          lead_id: string;
          note: string | null;
          quantity: number | null;
        };
        ComputedFields: never;
        Insert: {
          article_id: string;
          color_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id: string;
          note?: string | null;
          quantity?: number | null;
        };
        Update: {
          article_id?: string;
          color_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string;
          note?: string | null;
          quantity?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_items_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_items_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_items_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "article_colors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_items_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          business_name: string | null;
          city: string | null;
          contact_id: string | null;
          created_at: string;
          id: string;
          instagram: string | null;
          lost_reason: string | null;
          message: string | null;
          name: string;
          next_follow_up: string | null;
          phone: string;
          quoted_amount: number | null;
          source: Database["public"]["Enums"]["lead_source"];
          stage: Database["public"]["Enums"]["lead_stage"];
          updated_at: string;
          visitor_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          business_name?: string | null;
          city?: string | null;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          instagram?: string | null;
          lost_reason?: string | null;
          message?: string | null;
          name: string;
          next_follow_up?: string | null;
          phone: string;
          quoted_amount?: number | null;
          source: Database["public"]["Enums"]["lead_source"];
          stage?: Database["public"]["Enums"]["lead_stage"];
          updated_at?: string;
          visitor_id?: string | null;
        };
        Update: {
          business_name?: string | null;
          city?: string | null;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          instagram?: string | null;
          lost_reason?: string | null;
          message?: string | null;
          name?: string;
          next_follow_up?: string | null;
          phone?: string;
          quoted_amount?: number | null;
          source?: Database["public"]["Enums"]["lead_source"];
          stage?: Database["public"]["Enums"]["lead_stage"];
          updated_at?: string;
          visitor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          is_default?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["app_role"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      image_uploads: {
        Row: {
          attached_at: string | null;
          blur_data_url: string;
          created_at: string;
          folder: string;
          height: number;
          id: string;
          uploaded_by: string | null;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          attached_at?: string | null;
          blur_data_url: string;
          created_at?: string;
          folder: string;
          height: number;
          id?: string;
          uploaded_by?: string | null;
          width: number;
        };
        Update: {
          attached_at?: string | null;
          blur_data_url?: string;
          created_at?: string;
          folder?: string;
          height?: number;
          id?: string;
          uploaded_by?: string | null;
          width?: number;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          batch_id: string | null;
          bill_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          location_id: string;
          note: string | null;
          qty_change: number;
          reason: Database["public"]["Enums"]["movement_reason"];
          reverses_movement_id: string | null;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id?: string | null;
          bill_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string;
          note?: string | null;
          qty_change: number;
          reason: Database["public"]["Enums"]["movement_reason"];
          reverses_movement_id?: string | null;
          variant_id: string;
        };
        Update: {
          batch_id?: string | null;
          bill_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string;
          note?: string | null;
          qty_change?: number;
          reason?: Database["public"]["Enums"]["movement_reason"];
          reverses_movement_id?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_reverses_movement_id_fkey";
            columns: ["reverses_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      unanswered_questions: {
        Row: {
          created_at: string;
          faq_id: string | null;
          id: string;
          question: string;
          session_id: string | null;
          status: string;
          visitor_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          faq_id?: string | null;
          id?: string;
          question: string;
          session_id?: string | null;
          status?: string;
          visitor_id?: string | null;
        };
        Update: {
          created_at?: string;
          faq_id?: string | null;
          id?: string;
          question?: string;
          session_id?: string | null;
          status?: string;
          visitor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "unanswered_questions_faq_id_fkey";
            columns: ["faq_id"];
            isOneToOne: false;
            referencedRelation: "faq_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unanswered_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "chat_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unanswered_questions_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      variants: {
        Row: {
          article_id: string;
          color_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          last_movement_at: string | null;
          low_stock_threshold: number;
          size: string;
          size_order: number;
          sku: string;
          stock: number;
        };
        ComputedFields: never;
        Insert: {
          article_id: string;
          color_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_movement_at?: string | null;
          low_stock_threshold?: number;
          size: string;
          size_order?: number;
          sku: string;
          stock?: number;
        };
        Update: {
          article_id?: string;
          color_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_movement_at?: string | null;
          low_stock_threshold?: number;
          size?: string;
          size_order?: number;
          sku?: string;
          stock?: number;
        };
        Relationships: [
          {
            foreignKeyName: "variants_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variants_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variants_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "article_colors";
            referencedColumns: ["id"];
          },
        ];
      };
      visitor_events: {
        Row: {
          article_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          kind: string;
          visitor_id: string;
        };
        ComputedFields: never;
        Insert: {
          article_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          kind: string;
          visitor_id: string;
        };
        Update: {
          article_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          kind?: string;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visitor_events_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitor_events_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "public_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitor_events_visitor_id_fkey";
            columns: ["visitor_id"];
            isOneToOne: false;
            referencedRelation: "visitors";
            referencedColumns: ["id"];
          },
        ];
      };
      visitors: {
        Row: {
          consent_at: string | null;
          first_seen: string;
          id: string;
          instagram: string | null;
          last_seen: string;
          memory: string | null;
          name: string | null;
          phone: string | null;
          preferences: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          consent_at?: string | null;
          first_seen?: string;
          id: string;
          instagram?: string | null;
          last_seen?: string;
          memory?: string | null;
          name?: string | null;
          phone?: string | null;
          preferences?: NonNullable<Json>;
        };
        Update: {
          consent_at?: string | null;
          first_seen?: string;
          id?: string;
          instagram?: string | null;
          last_seen?: string;
          memory?: string | null;
          name?: string | null;
          phone?: string | null;
          preferences?: NonNullable<Json>;
        };
        Relationships: [];
      };
    };
    Views: {
      ai_usage_daily: {
        Row: {
          calls: number | null;
          day: string | null;
          failures: number | null;
          feature: string;
          tokens: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      inbox_open_by_contact: {
        Row: {
          contact_key: string | null;
          item_ids: string[] | null;
          kinds: Database["public"]["Enums"]["inbox_kind"][] | null;
          latest_at: string | null;
          name: string | null;
          oldest_at: string | null;
          open_count: number | null;
          phone: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      public_catalog: {
        Row: {
          availability: string | null;
          brand: string;
          category: Database["public"]["Enums"]["article_category"];
          code: string;
          colors: Json | null;
          created_at: string;
          description: string | null;
          fabric: string | null;
          garment: string;
          id: string;
          images: Json | null;
          is_featured: boolean;
          lot_size: number | null;
          moq: number;
          name: string;
          pattern: string | null;
          sizes: Json | null;
          style: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      public_settings: {
        Row: {
          address: string | null;
          business_name: string;
          city: string | null;
          email: string | null;
          established_year: number | null;
          facebook: string | null;
          instagram: string | null;
          phone: string | null;
          tagline: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          business_name?: string | null;
          city?: string | null;
          email?: string | null;
          instagram?: string | null;
          phone?: string | null;
          tagline?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          business_name?: string | null;
          city?: string | null;
          email?: string | null;
          instagram?: string | null;
          phone?: string | null;
          tagline?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      stock_by_location: {
        Row: {
          location_id: string;
          qty: number | null;
          variant_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "stock_movements_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      add_colour: { Args: { p: Json }; Returns: string };
      add_size: { Args: { p_article_id: string; p_size: string }; Returns: number };
      add_stock_batch: { Args: { p: Json }; Returns: string };
      ai_allowed: { Args: Record<PropertyKey, never>; Returns: boolean };
      apply_bill: { Args: { p_bill_id: string }; Returns: undefined };
      article_delete_report: { Args: { p_article_id: string }; Returns: Json };
      bootstrap_owner: { Args: { p_email: string; p_name?: string }; Returns: string };
      create_lead: { Args: { p: Json }; Returns: Json };
      finish_scan_job: { Args: { p_job: string; p: Json }; Returns: string };
      match_bill_line: { Args: { p_raw: string; p_name: string; p_colour: string; p_size: string }; Returns: Array<{ variant_id: string; method: string; confidence: number }> };
      norm_alias: { Args: { p: string }; Returns: string };
      save_bill_draft: { Args: { p_bill: string; p: Json; p_apply?: boolean }; Returns: Json };
      claim_scan_job: {
        Args: Record<PropertyKey, never>;
        Returns: {
          attempts: number;
          batch_ref: string;
          bill_id: string | null;
          created_at: string;
          created_by: string | null;
          error: string | null;
          file_hash: string | null;
          file_name: string | null;
          file_path: string;
          file_size: number | null;
          finished_at: string | null;
          id: string;
          mime_type: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["scan_status"];
        };
        SetofOptions: {
          from: "*";
          to: "bill_scan_jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_article_full: { Args: { p: Json }; Returns: string };
      create_manual_lead: { Args: { p: Json }; Returns: Json };
      delete_article: { Args: { p_article_id: string; p_updated_at: string }; Returns: Json };
      move_lead: {
        Args: { p_expected?: string; p_lead: string; p_reason?: string; p_stage: Database["public"]["Enums"]["lead_stage"] };
        Returns: Json;
      };
      handle_inbox_items: {
        Args: { p_ids: string[]; p_note?: string; p_via?: Database["public"]["Enums"]["inbox_via"] };
        Returns: number;
      };
      forget_image_folders: { Args: { folders: string[] }; Returns: number };
      import_stock: { Args: { p: Json }; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      next_article_code: { Args: { p_type: string }; Returns: string };
      orphan_image_folders: { Args: { older_than?: string }; Returns: string[] };
      purge_rate_limits: { Args: Record<PropertyKey, never>; Returns: number };
      rate_limit_allow: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      reset_stuck_scan_jobs: { Args: { p_max_attempts?: number; p_minutes?: number }; Returns: number };
      show_limit: { Args: Record<PropertyKey, never>; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      set_colour_photos: { Args: { p_color_id: string; p_images: Json }; Returns: number };
      size_rank: { Args: { p_pos: number; p_size: string }; Returns: number };
      undo_batch: { Args: { p_archive_article?: string; p_batch_id: string }; Returns: number };
      undo_bill: { Args: { p_bill_id: string }; Returns: undefined };
      undo_movement: { Args: { p_movement_id: string; p_note?: string }; Returns: string };
    };
    Enums: {
      activity_kind: "note" | "call" | "whatsapp" | "stage_change" | "enquiry" | "quote" | "follow_up";
      app_role: "owner" | "manager" | "warehouse" | "sales" | "accounts";
      article_category: "upperwear" | "lowerwear";
      article_source: "manufactured" | "purchased";
      bill_status: "draft" | "applied" | "undone";
      contact_role: "buyer" | "supplier" | "worker" | "employee" | "other";
      inbox_kind:
        "callback_request" | "call_tap" | "chat" | "request_price" | "contact_form" | "missed_call" | "whatsapp";
      inbox_status: "unanswered" | "handled" | "dismissed";
      inbox_via: "call" | "whatsapp" | "sms" | "other";
      lead_source: "request_price" | "enquiry_list" | "chatbot" | "contact_form" | "call_click" | "whatsapp" | "manual";
      lead_stage: "new" | "contacted" | "quoted" | "negotiation" | "won" | "lost";
      movement_reason: "production" | "sale" | "adjustment" | "return" | "undo" | "opening";
      scan_status: "queued" | "processing" | "extracted" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_kind: ["note", "call", "whatsapp", "stage_change", "enquiry", "quote", "follow_up"],
      app_role: ["owner", "manager", "warehouse", "sales", "accounts"],
      article_category: ["upperwear", "lowerwear"],
      article_source: ["manufactured", "purchased"],
      bill_status: ["draft", "applied", "undone"],
      contact_role: ["buyer", "supplier", "worker", "employee", "other"],
      inbox_kind: ["callback_request", "call_tap", "chat", "request_price", "contact_form", "missed_call", "whatsapp"],
      inbox_status: ["unanswered", "handled", "dismissed"],
      inbox_via: ["call", "whatsapp", "sms", "other"],
      lead_source: ["request_price", "enquiry_list", "chatbot", "contact_form", "call_click", "whatsapp", "manual"],
      lead_stage: ["new", "contacted", "quoted", "negotiation", "won", "lost"],
      movement_reason: ["production", "sale", "adjustment", "return", "undo", "opening"],
      scan_status: ["queued", "processing", "extracted", "failed"],
    },
  },
} as const;
