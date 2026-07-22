type AuditAction = "create" | "update" | "delete" | "action";

type AuditInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string | null;
  organizationId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: AuditAction;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
};

function toJsonValue(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { value: String(value) };
  }
}

export async function writeAuditLog(input: AuditInput) {
  try {
    await input.supabase.from("audit_logs").insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      before_data: toJsonValue(input.beforeData),
      after_data: toJsonValue(input.afterData),
      ip_address: input.ipAddress ?? null,
    });
  } catch {
    return;
  }
}
