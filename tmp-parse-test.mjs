import {
  parseQuickBulkText,
  QUICK_BULK_TEMPLATE_HEADER,
  QUICK_BULK_TEMPLATE_EXAMPLE,
} from "./src/lib/warranties/quick-warranty.ts";

console.log("HEADER:", QUICK_BULK_TEMPLATE_HEADER);
console.log(JSON.stringify(parseQuickBulkText(QUICK_BULK_TEMPLATE_EXAMPLE), null, 2));
