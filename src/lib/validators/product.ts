// Legacy file - schema mới dùng catalog.ts. Re-export để tránh break import cũ.
export {
  productCreateSchema,
  productUpdateSchema,
} from "./catalog";
export { listQuerySchema as productListQuerySchema } from "./common";
