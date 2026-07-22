import { auditLogsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { z } from "zod";

// Read-only collection (write từ trigger / service).
const noop = z.object({}).strict();
export const { GET } = makeCollectionHandlers({
  crud: auditLogsService,
  createSchema: noop,
  permissions: { read: "audit_logs.read" },
});
