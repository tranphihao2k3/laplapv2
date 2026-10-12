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
      ai_compare_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          fingerprint: string
          hit_count: number
          model: string
          payload: Json
          product_ids: string[]
          prompt_version: number
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          fingerprint: string
          hit_count?: number
          model?: string
          payload: Json
          product_ids: string[]
          prompt_version?: number
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          fingerprint?: string
          hit_count?: number
          model?: string
          payload?: Json
          product_ids?: string[]
          prompt_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: string | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      benchmark_drafts: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          payload: Json | null
          saved: boolean
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json | null
          saved?: boolean
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json | null
          saved?: boolean
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          organization_id: string | null
          show_on_homepage: boolean
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          organization_id?: string | null
          show_on_homepage?: boolean
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          organization_id?: string | null
          show_on_homepage?: boolean
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
          position: number | null
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
          position?: number | null
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          position?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          ip_address: unknown
          message: string
          phone: string | null
          status: string
          subject: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          ip_address?: unknown
          message: string
          phone?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          ip_address?: unknown
          message?: string
          phone?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          birthday: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          loyalty_points: number | null
          organization_id: string | null
          phone: string | null
          tier: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          loyalty_points?: number | null
          organization_id?: string | null
          phone?: string | null
          tier?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          loyalty_points?: number | null
          organization_id?: string | null
          phone?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gpu_benchmarks: {
        Row: {
          benchmark_tool: string | null
          condition: string | null
          created_at: string | null
          fps_avg: number | null
          fps_max: number | null
          fps_min: number | null
          gpu_rank: string | null
          gpu_score: number
          id: string
          laptop_id: string | null
          note: string | null
          tech_name: string | null
          test_date: string | null
          test_duration_seconds: number | null
          test_height: number | null
          test_preset: string | null
          test_width: number | null
        }
        Insert: {
          benchmark_tool?: string | null
          condition?: string | null
          created_at?: string | null
          fps_avg?: number | null
          fps_max?: number | null
          fps_min?: number | null
          gpu_rank?: string | null
          gpu_score: number
          id?: string
          laptop_id?: string | null
          note?: string | null
          tech_name?: string | null
          test_date?: string | null
          test_duration_seconds?: number | null
          test_height?: number | null
          test_preset?: string | null
          test_width?: number | null
        }
        Update: {
          benchmark_tool?: string | null
          condition?: string | null
          created_at?: string | null
          fps_avg?: number | null
          fps_max?: number | null
          fps_min?: number | null
          gpu_rank?: string | null
          gpu_score?: number
          id?: string
          laptop_id?: string | null
          note?: string | null
          tech_name?: string | null
          test_date?: string | null
          test_duration_seconds?: number | null
          test_height?: number | null
          test_preset?: string | null
          test_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gpu_benchmarks_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptop_rankings"
            referencedColumns: ["laptop_id"]
          },
          {
            foreignKeyName: "gpu_benchmarks_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptops"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_test_results: {
        Row: {
          created_at: string
          id: string
          laptop_id: string | null
          note: string | null
          payload: Json
          result: string
          test_type: string
          upload_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          laptop_id?: string | null
          note?: string | null
          payload?: Json
          result: string
          test_type: string
          upload_id: string
        }
        Update: {
          created_at?: string
          id?: string
          laptop_id?: string | null
          note?: string | null
          payload?: Json
          result?: string
          test_type?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hardware_test_results_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptop_rankings"
            referencedColumns: ["laptop_id"]
          },
          {
            foreignKeyName: "hardware_test_results_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hardware_test_results_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "mini_tool_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          organization_id: string | null
          product_variant_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          serial_number_id: string | null
          type: string
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string | null
          product_variant_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          serial_number_id?: string | null
          type: string
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string | null
          product_variant_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          serial_number_id?: string | null
          type?: string
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_serial_number_id_fkey"
            columns: ["serial_number_id"]
            isOneToOne: false
            referencedRelation: "serial_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      laptop_specs: {
        Row: {
          battery_cycles: number | null
          bios_serial: string | null
          bios_version: string | null
          cpu_cores: number | null
          cpu_name: string | null
          cpu_threads: number | null
          created_at: string | null
          gpu_driver_version: string | null
          gpu_name: string | null
          gpu_vram_gb: number | null
          id: string
          laptop_id: string | null
          mainboard: string | null
          motherboard_serial: string | null
          network_macs: Json | null
          os_activated: boolean | null
          os_arch: string | null
          os_build: string | null
          os_edition: string | null
          os_name: string | null
          os_version: string | null
          product_sku: string | null
          ram_gb: number | null
          ram_slots_detail: Json | null
          ram_type: string | null
          storage_drives: Json | null
          storage_gb: number | null
          storage_health_pct: number | null
          storage_type: string | null
          updated_at: string | null
          wifi_adapter: string | null
        }
        Insert: {
          battery_cycles?: number | null
          bios_serial?: string | null
          bios_version?: string | null
          cpu_cores?: number | null
          cpu_name?: string | null
          cpu_threads?: number | null
          created_at?: string | null
          gpu_driver_version?: string | null
          gpu_name?: string | null
          gpu_vram_gb?: number | null
          id?: string
          laptop_id?: string | null
          mainboard?: string | null
          motherboard_serial?: string | null
          network_macs?: Json | null
          os_activated?: boolean | null
          os_arch?: string | null
          os_build?: string | null
          os_edition?: string | null
          os_name?: string | null
          os_version?: string | null
          product_sku?: string | null
          ram_gb?: number | null
          ram_slots_detail?: Json | null
          ram_type?: string | null
          storage_drives?: Json | null
          storage_gb?: number | null
          storage_health_pct?: number | null
          storage_type?: string | null
          updated_at?: string | null
          wifi_adapter?: string | null
        }
        Update: {
          battery_cycles?: number | null
          bios_serial?: string | null
          bios_version?: string | null
          cpu_cores?: number | null
          cpu_name?: string | null
          cpu_threads?: number | null
          created_at?: string | null
          gpu_driver_version?: string | null
          gpu_name?: string | null
          gpu_vram_gb?: number | null
          id?: string
          laptop_id?: string | null
          mainboard?: string | null
          motherboard_serial?: string | null
          network_macs?: Json | null
          os_activated?: boolean | null
          os_arch?: string | null
          os_build?: string | null
          os_edition?: string | null
          os_name?: string | null
          os_version?: string | null
          product_sku?: string | null
          ram_gb?: number | null
          ram_slots_detail?: Json | null
          ram_type?: string | null
          storage_drives?: Json | null
          storage_gb?: number | null
          storage_health_pct?: number | null
          storage_type?: string | null
          updated_at?: string | null
          wifi_adapter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laptop_specs_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptop_rankings"
            referencedColumns: ["laptop_id"]
          },
          {
            foreignKeyName: "laptop_specs_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptops"
            referencedColumns: ["id"]
          },
        ]
      }
      laptops: {
        Row: {
          created_at: string | null
          device_id: string
          device_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          device_name: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          device_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          order_id: string | null
          points: number
          type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          order_id?: string | null
          points: number
          type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          order_id?: string | null
          points?: number
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mini_tool_sessions: {
        Row: {
          consumed_at: string | null
          context: Json
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          laptop_id: string | null
          session_id: string
        }
        Insert: {
          consumed_at?: string | null
          context?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          laptop_id?: string | null
          session_id: string
        }
        Update: {
          consumed_at?: string | null
          context?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          laptop_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mini_tool_sessions_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptop_rankings"
            referencedColumns: ["laptop_id"]
          },
          {
            foreignKeyName: "mini_tool_sessions_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptops"
            referencedColumns: ["id"]
          },
        ]
      }
      mini_tool_uploads: {
        Row: {
          created_at: string
          device_id: string
          device_name: string | null
          expires_at: string
          gpu_score: number | null
          id: string
          laptop_id: string | null
          os_info: Json | null
          payload: Json
          payload_version: string
          rejection_reason: string | null
          session_id: string | null
          signature: string | null
          source_ip: unknown
          status: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name?: string | null
          expires_at?: string
          gpu_score?: number | null
          id?: string
          laptop_id?: string | null
          os_info?: Json | null
          payload: Json
          payload_version?: string
          rejection_reason?: string | null
          session_id?: string | null
          signature?: string | null
          source_ip?: unknown
          status?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string | null
          expires_at?: string
          gpu_score?: number | null
          id?: string
          laptop_id?: string | null
          os_info?: Json | null
          payload?: Json
          payload_version?: string
          rejection_reason?: string | null
          session_id?: string | null
          signature?: string | null
          source_ip?: unknown
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mini_tool_uploads_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptop_rankings"
            referencedColumns: ["laptop_id"]
          },
          {
            foreignKeyName: "mini_tool_uploads_laptop_id_fkey"
            columns: ["laptop_id"]
            isOneToOne: false
            referencedRelation: "laptops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mini_tool_uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mini_tool_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      newsletter_outbox: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          product_brand_id: string | null
          product_brand_name: string | null
          product_id: string
          product_name: string
          product_price: number | null
          product_slug: string | null
          product_url: string
          scheduled_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          product_brand_id?: string | null
          product_brand_name?: string | null
          product_id: string
          product_name: string
          product_price?: number | null
          product_slug?: string | null
          product_url: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          product_brand_id?: string | null
          product_brand_name?: string | null
          product_id?: string
          product_name?: string
          product_price?: number | null
          product_slug?: string | null
          product_url?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      newsletter_send_log: {
        Row: {
          email: string
          error: string | null
          id: string
          outbox_id: string
          resend_message_id: string | null
          sent_at: string
          status: string
          subscriber_id: string
        }
        Insert: {
          email: string
          error?: string | null
          id?: string
          outbox_id: string
          resend_message_id?: string | null
          sent_at?: string
          status: string
          subscriber_id: string
        }
        Update: {
          email?: string
          error?: string | null
          id?: string
          outbox_id?: string
          resend_message_id?: string | null
          sent_at?: string
          status?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_send_log_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "newsletter_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_send_log_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "newsletter_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          brand_ids: string[]
          confirm_token: string | null
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          ip_address: unknown
          is_active: boolean
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          brand_ids?: string[]
          confirm_token?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          is_active?: boolean
          unsubscribe_token: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          brand_ids?: string[]
          confirm_token?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_snapshot: Json | null
          product_variant_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id?: string | null
          product_snapshot?: Json | null
          product_variant_id?: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string | null
          product_snapshot?: Json | null
          product_variant_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_logs: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_fulfillment_status: string | null
          from_payment_status: string | null
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          organization_id: string | null
          to_fulfillment_status: string | null
          to_payment_status: string | null
          to_status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_fulfillment_status?: string | null
          from_payment_status?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          organization_id?: string | null
          to_fulfillment_status?: string | null
          to_payment_status?: string | null
          to_status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_fulfillment_status?: string | null
          from_payment_status?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          organization_id?: string | null
          to_fulfillment_status?: string | null
          to_payment_status?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          discount_amount: number | null
          fulfillment_status: string | null
          id: string
          note: string | null
          order_number: string
          organization_id: string | null
          payment_status: string | null
          pos_session_id: string | null
          shop_id: string | null
          status: string | null
          subtotal: number | null
          total_amount: number | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          fulfillment_status?: string | null
          id?: string
          note?: string | null
          order_number: string
          organization_id?: string | null
          payment_status?: string | null
          pos_session_id?: string | null
          shop_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_amount?: number | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          fulfillment_status?: string | null
          id?: string
          note?: string | null
          order_number?: string
          organization_id?: string | null
          payment_status?: string | null
          pos_session_id?: string | null
          shop_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          code: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          parent_id: string | null
          phone: string | null
          settings: Json | null
          tax_code: string | null
          tax_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          settings?: Json | null
          tax_code?: string | null
          tax_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          settings?: Json | null
          tax_code?: string | null
          tax_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          id: string
          method: string | null
          order_id: string | null
          paid_at: string | null
          status: string | null
          transaction_code: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          method?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string | null
          transaction_code?: string | null
        }
        Update: {
          amount?: number | null
          id?: string
          method?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string | null
          transaction_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pc_build_items: {
        Row: {
          build_id: string
          category_slug: string
          created_at: string | null
          id: string
          product_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          build_id: string
          category_slug: string
          created_at?: string | null
          id?: string
          product_id: string
          qty?: number
          unit_price?: number
        }
        Update: {
          build_id?: string
          category_slug?: string
          created_at?: string | null
          id?: string
          product_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pc_build_items_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "pc_builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pc_build_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pc_builds: {
        Row: {
          created_at: string | null
          id: string
          is_public: boolean | null
          name: string
          note: string | null
          session_id: string | null
          share_slug: string | null
          total_price: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          note?: string | null
          session_id?: string | null
          share_slug?: string | null
          total_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          note?: string | null
          session_id?: string | null
          share_slug?: string | null
          total_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pc_components_specs: {
        Row: {
          category_slug: string
          extras: Json | null
          form_factor: string | null
          length_mm: number | null
          product_id: string
          ram_type: string | null
          socket: string | null
          storage_interface: string | null
          tdp_w: number | null
          updated_at: string | null
          wattage_w: number | null
        }
        Insert: {
          category_slug: string
          extras?: Json | null
          form_factor?: string | null
          length_mm?: number | null
          product_id: string
          ram_type?: string | null
          socket?: string | null
          storage_interface?: string | null
          tdp_w?: number | null
          updated_at?: string | null
          wattage_w?: number | null
        }
        Update: {
          category_slug?: string
          extras?: Json | null
          form_factor?: string | null
          length_mm?: number | null
          product_id?: string
          ram_type?: string | null
          socket?: string | null
          storage_interface?: string | null
          tdp_w?: number | null
          updated_at?: string | null
          wattage_w?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pc_components_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      pos_sessions: {
        Row: {
          closed_at: string | null
          closing_cash: number | null
          difference_cash: number | null
          expected_cash: number | null
          id: string
          opened_at: string | null
          opened_by: string | null
          opening_cash: number | null
          shop_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_cash?: number | null
          difference_cash?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string | null
          opening_cash?: number | null
          shop_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_cash?: number | null
          difference_cash?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string | null
          opening_cash?: number | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_gifts: {
        Row: {
          created_at: string
          gift_product_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          gift_product_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          gift_product_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_gifts_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_gifts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          product_id: string
          rating: number | null
          user_name: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          rating?: number | null
          user_name?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json | null
          barcode: string | null
          cost_price: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string | null
          product_id: string | null
          selling_price: number | null
          sku: string
          specs: Json | null
          weight: number | null
        }
        Insert: {
          attributes?: Json | null
          barcode?: string | null
          cost_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          product_id?: string | null
          selling_price?: number | null
          sku: string
          specs?: Json | null
          weight?: number | null
        }
        Update: {
          attributes?: Json | null
          barcode?: string | null
          cost_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          product_id?: string | null
          selling_price?: number | null
          sku?: string
          specs?: Json | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          is_hot: boolean | null
          is_new: boolean | null
          name: string
          organization_id: string | null
          rating_avg: number | null
          review_count: number | null
          short_description: string | null
          slug: string | null
          sold_count: number | null
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          is_hot?: boolean | null
          is_new?: boolean | null
          name: string
          organization_id?: string | null
          rating_avg?: number | null
          review_count?: number | null
          short_description?: string | null
          slug?: string | null
          sold_count?: number | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          is_hot?: boolean | null
          is_new?: boolean | null
          name?: string
          organization_id?: string | null
          rating_avg?: number | null
          review_count?: number | null
          short_description?: string | null
          slug?: string | null
          sold_count?: number | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          product_variant_id: string | null
          purchase_order_id: string | null
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_variant_id?: string | null
          purchase_order_id?: string | null
          quantity: number
          unit_cost: number
        }
        Update: {
          id?: string
          product_variant_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          expected_at: string | null
          id: string
          ordered_at: string | null
          po_number: string
          status: string | null
          supplier_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expected_at?: string | null
          id?: string
          ordered_at?: string | null
          po_number: string
          status?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expected_at?: string | null
          id?: string
          ordered_at?: string | null
          po_number?: string
          status?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_services: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          organization_id: string | null
          position: number
          price_max: number | null
          price_min: number | null
          price_type: string
          slug: string | null
          unit: string | null
          updated_at: string | null
          warranty_text: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          organization_id?: string | null
          position?: number
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          slug?: string | null
          unit?: string | null
          updated_at?: string | null
          warranty_text?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          organization_id?: string | null
          position?: number
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          slug?: string | null
          unit?: string | null
          updated_at?: string | null
          warranty_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tickets: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          completed_at: string | null
          condition_description: string | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          device_name: string | null
          estimated_cost: number | null
          id: string
          images: Json | null
          issue_description: string | null
          repair_solution: string | null
          serial_number: string | null
          shop_id: string | null
          status: string | null
          ticket_code: string | null
          warranty_months: number | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          condition_description?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          device_name?: string | null
          estimated_cost?: number | null
          id?: string
          images?: Json | null
          issue_description?: string | null
          repair_solution?: string | null
          serial_number?: string | null
          shop_id?: string | null
          status?: string | null
          ticket_code?: string | null
          warranty_months?: number | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          condition_description?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          device_name?: string | null
          estimated_cost?: number | null
          id?: string
          images?: Json | null
          issue_description?: string | null
          repair_solution?: string | null
          serial_number?: string | null
          shop_id?: string | null
          status?: string | null
          ticket_code?: string | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_tickets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      return_order_items: {
        Row: {
          created_at: string | null
          id: string
          order_item_id: string | null
          product_variant_id: string
          quantity: number
          reason: string | null
          restock: boolean | null
          return_order_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_item_id?: string | null
          product_variant_id: string
          quantity: number
          reason?: string | null
          restock?: boolean | null
          return_order_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_item_id?: string | null
          product_variant_id?: string
          quantity?: number
          reason?: string | null
          restock?: boolean | null
          return_order_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_order_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_order_items_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "return_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      return_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          organization_id: string | null
          reason: string | null
          refund_amount: number | null
          refund_method: string | null
          refund_status: string | null
          return_number: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          organization_id?: string | null
          reason?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          refund_status?: string | null
          return_number: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          organization_id?: string | null
          reason?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          refund_status?: string | null
          return_number?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      serial_numbers: {
        Row: {
          id: string
          imei: string | null
          imported_at: string | null
          product_variant_id: string | null
          serial: string | null
          sold_at: string | null
          status: string | null
          warehouse_id: string | null
        }
        Insert: {
          id?: string
          imei?: string | null
          imported_at?: string | null
          product_variant_id?: string | null
          serial?: string | null
          sold_at?: string | null
          status?: string | null
          warehouse_id?: string | null
        }
        Update: {
          id?: string
          imei?: string | null
          imported_at?: string | null
          product_variant_id?: string | null
          serial?: string | null
          sold_at?: string | null
          status?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serial_numbers_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          group_name: string | null
          id: string
          key: string | null
          organization_id: string | null
          shop_id: string | null
          value: Json | null
        }
        Insert: {
          group_name?: string | null
          id?: string
          key?: string | null
          organization_id?: string | null
          shop_id?: string | null
          value?: Json | null
        }
        Update: {
          group_name?: string | null
          id?: string
          key?: string | null
          organization_id?: string | null
          shop_id?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_staff: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          role_id: string | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_staff_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          allowed_domains: string[]
          code: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          phone: string | null
          primary_domain: string | null
          timezone: string | null
        }
        Insert: {
          address?: string | null
          allowed_domains?: string[]
          code: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          phone?: string | null
          primary_domain?: string | null
          timezone?: string | null
        }
        Update: {
          address?: string | null
          allowed_domains?: string[]
          code?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          phone?: string | null
          primary_domain?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_songs: {
        Row: {
          artist: string | null
          created_at: string | null
          duration_seconds: number | null
          file_key: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_active: boolean
          position: number
          title: string
          updated_at: string | null
        }
        Insert: {
          artist?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_key: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_active?: boolean
          position?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          artist?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_key?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_active?: boolean
          position?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      spec_templates: {
        Row: {
          category_id: string | null
          created_at: string | null
          fields: Json
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          fields: Json
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          fields?: Json
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spec_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          available_qty: number | null
          incoming_qty: number | null
          product_variant_id: string
          reserved_qty: number | null
          warehouse_id: string
        }
        Insert: {
          available_qty?: number | null
          incoming_qty?: number | null
          product_variant_id: string
          reserved_qty?: number | null
          warehouse_id: string
        }
        Update: {
          available_qty?: number | null
          incoming_qty?: number | null
          product_variant_id?: string
          reserved_qty?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string
          created_at: string | null
          email: string | null
          id: string
          organization_id: string | null
          phone: string | null
          tax_code: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          created_at?: string | null
          email?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          tax_code?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string | null
          email?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          tax_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_scan_results: {
        Row: {
          created_at: string
          expires_at: string
          payload: Json | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          payload?: Json | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          payload?: Json | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          exec_name: string
          extract: boolean
          icon: string
          id: string
          launch_args: Json
          name: string
          r2_key: string
          requires_admin: boolean
          sha256: string
          size_bytes: number
          sort_order: number
          status: string
          updated_at: string
          vendor: string | null
          version: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          exec_name: string
          extract?: boolean
          icon?: string
          id: string
          launch_args?: Json
          name: string
          r2_key: string
          requires_admin?: boolean
          sha256?: string
          size_bytes?: number
          sort_order?: number
          status?: string
          updated_at?: string
          vendor?: string | null
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          exec_name?: string
          extract?: boolean
          icon?: string
          id?: string
          launch_args?: Json
          name?: string
          r2_key?: string
          requires_admin?: boolean
          sha256?: string
          size_bytes?: number
          sort_order?: number
          status?: string
          updated_at?: string
          vendor?: string | null
          version?: string | null
        }
        Relationships: []
      }
      trade_in_requests: {
        Row: {
          condition_note: string | null
          created_at: string | null
          customer_id: string | null
          device_name: string | null
          id: string
          images: Json | null
          offered_price: number | null
          serial_number: string | null
          status: string | null
        }
        Insert: {
          condition_note?: string | null
          created_at?: string | null
          customer_id?: string | null
          device_name?: string | null
          id?: string
          images?: Json | null
          offered_price?: number | null
          serial_number?: string | null
          status?: string | null
        }
        Update: {
          condition_note?: string | null
          created_at?: string | null
          customer_id?: string | null
          device_name?: string | null
          id?: string
          images?: Json | null
          offered_price?: number | null
          serial_number?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_in_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_name: string | null
          name: string
          organization_id: string | null
          phone: string | null
          shop_id: string | null
          type: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name: string
          organization_id?: string | null
          phone?: string | null
          shop_id?: string | null
          type?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          shop_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          customer_id: string | null
          end_date: string | null
          id: string
          note: string | null
          order_id: string | null
          repair_ticket_id: string | null
          serial_number_id: string | null
          start_date: string | null
          status: string | null
          warranty_type: string | null
        }
        Insert: {
          customer_id?: string | null
          end_date?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          repair_ticket_id?: string | null
          serial_number_id?: string | null
          start_date?: string | null
          status?: string | null
          warranty_type?: string | null
        }
        Update: {
          customer_id?: string | null
          end_date?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          repair_ticket_id?: string | null
          serial_number_id?: string | null
          start_date?: string | null
          status?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_repair_ticket_id_fkey"
            columns: ["repair_ticket_id"]
            isOneToOne: false
            referencedRelation: "repair_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_serial_number_id_fkey"
            columns: ["serial_number_id"]
            isOneToOne: false
            referencedRelation: "serial_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      laptop_rankings: {
        Row: {
          cpu_cores: number | null
          cpu_name: string | null
          device_name: string | null
          gpu_name: string | null
          gpu_rank: string | null
          gpu_score: number | null
          gpu_vram_gb: number | null
          laptop_id: string | null
          percentile: number | null
          ram_gb: number | null
          ram_type: string | null
          test_date: string | null
        }
        Relationships: []
      }
      v_revenue_daily: {
        Row: {
          cancelled_amount: number | null
          cancelled_orders: number | null
          completed_orders: number | null
          day: string | null
          organization_id: string | null
          revenue: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_return_order: {
        Args: { p_return_id: string; p_warehouse_id?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          organization_id: string | null
          reason: string | null
          refund_amount: number | null
          refund_method: string | null
          refund_status: string | null
          return_number: string
          status: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "return_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_gpu_rank: { Args: { score: number }; Returns: string }
      calculate_percentile: { Args: { laptop_uuid: string }; Returns: number }
      cancel_order: { Args: { p_order_id: string }; Returns: Json }
      change_order_status: {
        Args: {
          p_note?: string
          p_order_id: string
          p_to_fulfillment_status?: string
          p_to_payment_status?: string
          p_to_status?: string
        }
        Returns: {
          channel: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          discount_amount: number | null
          fulfillment_status: string | null
          id: string
          note: string | null
          order_number: string
          organization_id: string | null
          payment_status: string | null
          pos_session_id: string | null
          shop_id: string | null
          status: string | null
          subtotal: number | null
          total_amount: number | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      checkout_order: { Args: { payload: Json }; Returns: Json }
      close_pos_session: {
        Args: { p_closing_cash: number; p_session_id: string }
        Returns: Json
      }
      create_return_order: {
        Args: { payload: Json }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          organization_id: string | null
          reason: string | null
          refund_amount: number | null
          refund_method: string | null
          refund_status: string | null
          return_number: string
          status: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "return_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_org_id: { Args: never; Returns: string }
      has_permission: { Args: { p_code: string }; Returns: boolean }
      receive_purchase_order: {
        Args: { p_po_id: string; p_serials: Json }
        Returns: Json
      }
      transfer_inventory: {
        Args: {
          p_from_warehouse: string
          p_items: Json
          p_note: string
          p_to_warehouse: string
        }
        Returns: Json
      }
      user_in_shop: { Args: { p_shop_id: string }; Returns: boolean }
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

