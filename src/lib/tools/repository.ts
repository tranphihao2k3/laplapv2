/**
 * Tools Repository — DB-backed catalog (replace TOOL_CATALOG hardcoded).
 *
 * Backend: Supabase table `tools` (xem 021_tools_catalog.sql).
 * - Read: public (any user can GET /api/v1/tools).
 * - Write: admin only (permission 'admin.manage_tools').
 *
 * File storage: R2 bucket 'laplap-tools' (binding TOOLS_BUCKET).
 * - Admin upload file qua /api/v1/admin/tools/upload (multipart).
 * - Stream download qua /api/v1/tools/download (server proxy R2 -> client).
 * - KHONG bao gio public R2 URL truc tiep (tranh leaker / abuse).
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ToolStatus = "active" | "hidden" | "disabled";

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  r2_key: string;
  sha256: string;
  exec_name: string;
  extract: boolean;
  launch_args: string[];
  requires_admin: boolean;
  size_bytes: number;
  version: string | null;
  vendor: string | null;
  status: ToolStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ToolInput {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  r2_key: string;
  sha256?: string;
  exec_name: string;
  extract?: boolean;
  launch_args?: string[];
  requires_admin?: boolean;
  size_bytes?: number;
  version?: string;
  vendor?: string;
  status?: ToolStatus;
  sort_order?: number;
}

/** Resolve tool theo id (public, RLS enables public read). */
export async function findToolById(id: string): Promise<Tool | null> {
  const supabase = await createClient();
  const { data, error } = (await supabase
    .from("tools")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: Tool | null; error: unknown };

  if (error) throw error;
  return data;
}

/** List active tools (theo sort_order). */
export async function listActiveTools(): Promise<Tool[]> {
  const supabase = await createClient();
  const { data, error } = (await supabase
    .from("tools")
    .select("*")
    .in("status", ["active", "hidden"]) // hidden van cho admin thay tren dashboard
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })) as { data: Tool[] | null; error: unknown };

  if (error) throw error;
  return data ?? [];
}

/** List tools (admin only, bao gom disabled). */
export async function listAllTools(): Promise<Tool[]> {
  const supabase = await createAdminClient();
  const { data, error } = (await supabase
    .from("tools")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })) as { data: Tool[] | null; error: unknown };

  if (error) throw error;
  return data ?? [];
}

/** Insert tool metadata (admin only). */
export async function insertTool(tool: ToolInput, createdBy: string): Promise<Tool> {
  const supabase = createAdminClient();
  const { data, error } = (await supabase
    .from("tools")
    .insert({
      ...tool,
      description: tool.description ?? "",
      category: tool.category ?? "utility",
      icon: tool.icon ?? "🔧",
      sha256: tool.sha256 ?? "VERIFY_REQUIRED",
      extract: tool.extract ?? true,
      launch_args: tool.launch_args ?? [],
      requires_admin: tool.requires_admin ?? false,
      size_bytes: tool.size_bytes ?? 0,
      status: tool.status ?? "active",
      sort_order: tool.sort_order ?? 100,
      created_by: createdBy,
    })
    .select()
    .single()) as { data: Tool | null; error: unknown };

  if (error) throw error;
  if (!data) throw new Error("Failed to insert tool");
  return data;
}

/** Update tool metadata (admin only). */
export async function updateTool(
  id: string,
  patch: Partial<ToolInput>,
): Promise<Tool> {
  const supabase = createAdminClient();
  const { data, error } = (await supabase
    .from("tools")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()) as { data: Tool | null; error: unknown };

  if (error) throw error;
  if (!data) throw new Error("Tool not found");
  return data;
}

/** Delete tool (admin only). Caller phai xoa R2 file truoc. */
export async function deleteTool(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) throw error;
}

/** Verify-Sha256 mode (mirror tools/catalog.ts constants). */
export function verifyModeOf(sha256: string): "verified" | "required" | "skip" {
  if (sha256 === "VERIFY_REQUIRED") return "required";
  if (sha256 === "VERIFY_SKIP") return "skip";
  return "verified";
}

/** Format bytes -> "15 MB" cho UI. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
