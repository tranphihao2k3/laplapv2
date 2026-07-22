"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

const KEYS = {
  all: ["products"] as const,
  list: (search?: string) => [...KEYS.all, "list", search ?? ""] as const,
  detail: (id: string) => [...KEYS.all, "detail", id] as const,
};

export function useProducts(search?: string) {
  return useQuery({
    queryKey: KEYS.list(search),
    queryFn: async (): Promise<Product[]> => {
      const supabase = createClient();
      let query = supabase.from("products").select("*").order("created_at", { ascending: false });
      if (search) query = query.ilike("name", `%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async (): Promise<Product | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductInsert): Promise<Product> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .insert(input as never)
        .select()
        .single();
      if (error) throw error;
      return data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
