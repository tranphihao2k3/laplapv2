import { makeCollectionHandlers } from "../_route-factory";
import { vouchersService } from "@/server/services/vouchers-service";
import { voucherCreateSchema } from "@/lib/validators/voucher";
import { z } from "zod";

export const { GET, POST } = makeCollectionHandlers({
  crud: vouchersService,
  createSchema: voucherCreateSchema as unknown as z.ZodType<z.infer<typeof voucherCreateSchema>>,
  permissions: { read: "vouchers.read", create: "vouchers.create" },
});
