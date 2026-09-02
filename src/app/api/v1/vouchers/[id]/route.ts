import { makeItemHandlers } from "../../_route-factory";
import { vouchersService } from "@/server/services/vouchers-service";
import { voucherUpdateSchema } from "@/lib/validators/voucher";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: vouchersService,
  updateSchema: voucherUpdateSchema,
  permissions: {
    read: "vouchers.read",
    update: "vouchers.update",
    remove: "vouchers.delete",
  },
});
