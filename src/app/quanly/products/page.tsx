"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Save, X, FileText, Cpu, Gift, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { useCrudCreate, useCrudDelete, useCrudList, useCrudUpdate, useMyShops } from "@/lib/api/admin-crud";
import { createClient } from "@/lib/supabase/client";
import { buildCategoryTree, findTemplateForCategory, getAncestors } from "@/lib/category-tree";
import { GiftProductPicker, type GiftProductLite } from "@/components/admin/gift-product-picker";
import { AIPasteBox, type ParseSuggestions } from "@/components/admin/ai-paste-box";
import { Section } from "@/components/ui/section";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";

type Product = {
  id: string;
  name: string;
  slug: string;
  status: string;
  brand_id: string | null;
  category_id: string | null;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  images?: string[] | null;
  tags: string[] | null;
  gift_product_ids?: string[];
  gifts?: Array<{ id: string; name: string; slug: string; thumbnail_url: string | null; status: string | null }>;
  variants_count?: number;
};

type VariantInput = {
  id?: string;
  sku: string;
  name: string;
  selling_price: number;
  cost_price: number;
  weight?: number;
  is_active: boolean;
  initial_stock?: number;
};

type VariantRow = {
  id: string;
  product_id?: string | null;
  sku: string;
  name: string | null;
  selling_price: number | null;
  cost_price: number | null;
  is_active: boolean | null;
  specs: Record<string, unknown> | null;
};

type ApiListResponse<T> = {
  ok: boolean;
  data?: {
    items: T[];
  };
};

type SpecTemplate = {
  id: string;
  name: string;
  category_id: string | null;
  fields: Array<{ key: string; label?: string; type?: string }> | null;
};

type Warehouse = { id: string; name: string; code: string | null };

const TAG_SUGGESTIONS = ["gaming", "ultrabook", "văn phòng", "đồ họa", "mỏng nhẹ", "sinh viên", "intel", "amd"];

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function withDateSuffix(base: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${base}-${y}${m}${day}`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const payload = error as { error?: { message?: string; fields?: Record<string, string[] | undefined>; requestId?: string } };
    const msg = payload.error?.message;
    const fieldMsg = Object.values(payload.error?.fields ?? {}).flat().filter(Boolean).join(" · ");
    const requestId = payload.error?.requestId;
    if (msg || fieldMsg || requestId) {
      return [msg, fieldMsg, requestId ? `requestId=${requestId}` : ""].filter(Boolean).join(" | ");
    }
  }
  return "Đã xảy ra lỗi";
}

export default function ProductsAdminPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; localUrl: string }[]>([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [specTemplateId, setSpecTemplateId] = useState("");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [selectedGifts, setSelectedGifts] = useState<GiftProductLite[]>([]);
  // Đánh dấu khi user đã sửa slug bằng tay → ngừng auto-generate từ tên
  const [slugTouched, setSlugTouched] = useState(false);
  // Giá bán nhanh — dùng khi sản phẩm đơn giản (balo, chuột...) không cần biến thể chi tiết
  const [quickPrice, setQuickPrice] = useState<number | "">("");
  // Cửa hàng đang thao tác — lấy từ tài khoản login (shop_staff). Kho sẽ lọc theo cửa hàng này.
  const [shopId, setShopId] = useState("");
  // Tồn kho ban đầu cho sản phẩm mới — sẽ ghi vào stock_levels sau khi tạo variant
  const [warehouseId, setWarehouseId] = useState("");
  const [quickStock, setQuickStock] = useState<number | "">("");
  // Tab cho ô mô tả chi tiết: chỉnh sửa HTML thô / xem preview render
  const [descriptionTab, setDescriptionTab] = useState<"edit" | "preview">("edit");

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: { file: File; localUrl: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const localUrl = URL.createObjectURL(file);
      newFiles.push({ file, localUrl });
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    if (!coverUrl && newFiles.length > 0) {
      setCoverUrl(newFiles[0].localUrl);
    }
  };

  // Variants in current form
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const [newSku, setNewSku] = useState("");
  const [newVarName, setNewVarName] = useState("");
  const [newSellingPrice, setNewSellingPrice] = useState(0);
  const [newCostPrice, setNewCostPrice] = useState(0);
  const [newInitialStock, setNewInitialStock] = useState(0);

  // Queries & Mutations
  const productsQuery = useCrudList<Product>("products", { search, page, pageSize: 20 });
  const brandsQuery = useCrudList<{ id: string; name: string }>("brands", { pageSize: 100 });
  const categoriesQuery = useCrudList<{ id: string; name: string; parent_id: string | null; position?: number | null }>("categories", { pageSize: 100 });
  const specTemplatesQuery = useCrudList<SpecTemplate>("spec-templates", { pageSize: 100 });
  const myShopsQuery = useMyShops();
  // Kho lọc theo cửa hàng đang chọn. Chưa chọn shop → không truyền filter (hiển thị tất cả).
  const warehousesQuery = useCrudList<Warehouse>("warehouses", {
    pageSize: 100,
    filters: shopId ? { shop_id: shopId } : undefined,
  });
  // Lazy query for variants - only when needed for CRUD operations
  const variantsQuery = useCrudList<VariantRow>("product-variants", { pageSize: 1000 });

  const createProduct = useCrudCreate<Product, Record<string, unknown>>("products");
  const updateProduct = useCrudUpdate<Product, Record<string, unknown>>("products");
  const deleteProduct = useCrudDelete("products");
  const createVariant = useCrudCreate<Record<string, unknown>, Record<string, unknown>>("product-variants");
  const updateVariant = useCrudUpdate<Record<string, unknown>, Record<string, unknown>>("product-variants");
  const deleteVariant = useCrudDelete("product-variants");

  const activeProducts = productsQuery.data?.items ?? [];
  const brands = brandsQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];
  const specTemplates = specTemplatesQuery.data?.items ?? [];
  const myShops = useMemo(() => myShopsQuery.data ?? [], [myShopsQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data?.items ?? [], [warehousesQuery.data]);
  const currentTemplate = specTemplates.find((t) => t.id === specTemplateId);
  const templateFields = currentTemplate?.fields ?? [];

  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const sortedProducts = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const getCategoryName = (prod: Product) => {
      if (!prod.category_id) return "";
      return categoryMap.get(prod.category_id) ?? "";
    };

    return [...activeProducts].sort((a, b) => {
      const catA = normalize(getCategoryName(a));
      const catB = normalize(getCategoryName(b));

      const aIsLaptop = catA.includes("laptop");
      const bIsLaptop = catB.includes("laptop");
      if (aIsLaptop !== bIsLaptop) return aIsLaptop ? -1 : 1;

      if (catA !== catB) return catA.localeCompare(catB, "vi");
      return a.name.localeCompare(b.name, "vi");
    });
  }, [activeProducts, categoryMap]);

  // Cây danh mục để dropdown có thụt lề cha-con
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Options cho các SearchableSelect (danh mục / thương hiệu / spec template)
  const categoryOptions = useMemo<SearchableOption[]>(
    () => categoryTree.map((c) => ({ value: c.id, label: c.name, depth: c.depth })),
    [categoryTree],
  );
  const brandOptions = useMemo<SearchableOption[]>(
    () => brands.map((b) => ({ value: b.id, label: b.name })),
    [brands],
  );
  const specTemplateOptions = useMemo<SearchableOption[]>(
    () => specTemplates.map((t) => ({ value: t.id, label: t.name })),
    [specTemplates],
  );
  const shopOptions = useMemo<SearchableOption[]>(
    () => myShops.map((s) => ({ value: s.id, label: s.name, keywords: s.code ?? "" })),
    [myShops],
  );
  const warehouseOptions = useMemo<SearchableOption[]>(
    () => warehouses.map((w) => ({ value: w.id, label: w.name, keywords: w.code ?? "" })),
    [warehouses],
  );

  // Tự chọn cửa hàng đầu tiên của user khi load xong (nếu chưa chọn).
  useEffect(() => {
    if (!shopId && myShops.length > 0) setShopId(myShops[0].id);
  }, [shopId, myShops]);

  // Khi đổi cửa hàng (hoặc kho load lại theo shop), tự chọn kho đầu tiên nếu kho hiện tại
  // không còn thuộc danh sách. Chỉ chạy khi đang tạo mới để tránh ghi đè lúc edit.
  useEffect(() => {
    if (editingProduct) return;
    if (warehouses.length === 0) return;
    if (!warehouseId || !warehouses.some((w) => w.id === warehouseId)) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId, editingProduct]);

  // Template kế thừa từ cây danh mục (nếu category con không có template riêng, lấy của cha)
  const inheritedTemplate = useMemo(
    () => findTemplateForCategory(categoryId || null, specTemplates, categories),
    [categoryId, specTemplates, categories],
  );

  // Khi mở dialog edit, spec_templates có thể chưa load xong tại thời điểm startEdit chạy.
  // Effect này theo dõi categoryId + template list → auto chọn template kế thừa nếu user chưa chọn.
  useEffect(() => {
    if (!open || !categoryId || specTemplateId) return;
    const inherited = findTemplateForCategory(categoryId, specTemplates, categories);
    if (inherited) setSpecTemplateId(inherited.id);
  }, [open, categoryId, specTemplateId, specTemplates, categories]);

  // Đường dẫn category cha → con (chuỗi "Laptop / Laptop Gaming") để hiển thị gợi ý kế thừa
  const inheritedFromName = useMemo(() => {
    if (!inheritedTemplate || !inheritedTemplate.category_id || !categoryId) return null;
    if (inheritedTemplate.category_id === categoryId) return null; // cùng cấp, không phải kế thừa
    const cat = categories.find((c) => c.id === inheritedTemplate.category_id);
    return cat?.name ?? null;
  }, [inheritedTemplate, categoryId, categories]);

  const imagePreviews = Array.from(
    new Set([
      ...(thumbnailUrl ? [thumbnailUrl] : []),
      ...existingImages,
      ...selectedFiles.map((item) => item.localUrl),
    ]),
  );

  // Populate form for Editing
  const startEdit = async (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name ?? "");
    setSlug(prod.slug ?? "");
    setStatus(prod.status ?? "draft");
    setBrandId(prod.brand_id ?? "");
    setCategoryId(prod.category_id ?? "");
    // Đặt template kế thừa ngay (nếu data có sẵn). Nếu specTemplates còn đang loading,
    // useEffect bên dưới sẽ fill sau khi list tải xong.
    const inheritedNow = findTemplateForCategory(prod.category_id ?? null, specTemplates, categories);
    setSpecTemplateId(inheritedNow?.id ?? "");
    setSpecValues({});
    setShortDesc(prod.short_description ?? "");
    setDescription(prod.description ?? "");
    setThumbnailUrl(prod.thumbnail_url ?? "");
    setCoverUrl(prod.thumbnail_url ?? "");
    setExistingImages(
      Array.isArray(prod.images) && prod.images.length > 0
        ? prod.images
        : prod.thumbnail_url
          ? [prod.thumbnail_url]
          : [],
    );
    setSelectedFiles([]);
    setTagsInput(prod.tags ? prod.tags.join(", ") : "");
    setSelectedGifts(
      (prod.gifts ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        thumbnail_url: g.thumbnail_url,
        status: g.status,
      })),
    );
    setSlugTouched(true); // khi edit, slug đã có sẵn → không auto-overwrite từ name
    setQuickPrice("");
    setQuickStock("");
    setWarehouseId("");

    // Fetch existing variants of this product
    try {
      const response = await fetch(`/api/v1/product-variants?product_id=${prod.id}`);
      const resData = (await response.json()) as ApiListResponse<VariantRow>;
      if (resData.ok && resData.data) {
        const mapped = resData.data.items.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name ?? "",
          selling_price: v.selling_price ?? 0,
          cost_price: v.cost_price ?? 0,
          is_active: v.is_active ?? true,
        }));
        setVariants(mapped);
        const firstSpecs = resData.data.items.find((v) => v.specs && typeof v.specs === "object")?.specs;
        if (firstSpecs && typeof firstSpecs === "object") {
          const normalized = Object.fromEntries(
            Object.entries(firstSpecs).map(([k, v]) => [k, v == null ? "" : String(v)]),
          );
          setSpecValues(normalized);
        }
      }
    } catch {
      setVariants([]);
    }
    setOpen(true);
  };

  const startCreate = () => {
    setEditingProduct(null);
    setName("");
    setSlug("");
    setStatus("active");
    setBrandId("");
    setCategoryId("");
    setSpecTemplateId("");
    setSpecValues({});
    setShortDesc("");
    setDescription("");
    setThumbnailUrl("");
    setCoverUrl("");
    setExistingImages([]);
    setSelectedFiles([]);
    setTagsInput("");
    setSelectedGifts([]);
    setSlugTouched(false);
    setQuickPrice("");
    setQuickStock(1);
    // Cửa hàng + kho: auto chọn cửa hàng của user rồi kho đầu tiên (qua useEffect).
    // Nếu shop đã được set sẵn thì giữ nguyên; kho để effect đồng bộ theo shop.
    if (!shopId) setShopId(myShops[0]?.id ?? "");
    setWarehouseId(warehouses[0]?.id ?? "");
    setVariants([]);
    setOpen(true);
  };

  const applyAISuggestions = (s: ParseSuggestions) => {
    if (s.name) setName(s.name);
    if (s.slug) {
      const existed = activeProducts.some((p) => p.slug === s.slug && p.id !== editingProduct?.id);
      setSlug(existed ? withDateSuffix(s.slug) : s.slug);
      setSlugTouched(true);
    }
    if (s.brand_id) setBrandId(s.brand_id);
    if (s.category_id) {
      setCategoryId(s.category_id);
    }
    // Ưu tiên template AI chọn; nếu AI không chọn được nhưng có category → kế thừa
    if (s.spec_template_id) {
      setSpecTemplateId(s.spec_template_id);
    } else if (s.category_id) {
      const inherited = findTemplateForCategory(s.category_id, specTemplates, categories);
      if (inherited) setSpecTemplateId(inherited.id);
    }
    if (s.short_description) setShortDesc(s.short_description);
    if (s.description) {
      // AI trả về HTML đầy đủ các section. Loại bỏ wrap ```html``` nếu có.
      const cleaned = s.description
        .trim()
        .replace(/^```(?:html)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      setDescription(cleaned);
      setDescriptionTab("preview");
    }
    // Gộp nhóm nhu cầu (need_tags, slug chuẩn) + tags thường vào 1 danh sách, need_tags đứng trước.
    {
      const merged: string[] = [];
      for (const t of [...(s.need_tags ?? []), ...(s.tags ?? [])]) {
        const v = t.trim();
        if (v && !merged.includes(v)) merged.push(v);
      }
      if (merged.length) setTagsInput(merged.join(", "));
    }
    if (s.specs && Object.keys(s.specs).length) {
      setSpecValues((prev) => ({ ...prev, ...s.specs }));
    }
    // Bảo hành: AI trả về warranty_months top-level → auto map sang spec key 'warranty'
    // (hoặc 'bao_hanh' nếu template dùng tiếng Việt). Form spec sẽ hiển thị "3 tháng".
    if (s.warranty_months != null && s.warranty_months > 0) {
      setSpecValues((prev) => ({
        ...prev,
        warranty: prev.warranty || `${s.warranty_months} tháng`,
        bao_hanh: prev.bao_hanh || `${s.warranty_months} tháng`,
      }));
    }
    if (s.selling_price != null && s.selling_price > 0) {
      setQuickPrice(s.selling_price);
      if (!editingProduct && variants.length === 0) {
        const defaultSku = s.name ? slugify(s.name).toUpperCase() : "VAR-DEFAULT";
        setVariants([
          {
            sku: defaultSku,
            name: "Mặc định",
            selling_price: s.selling_price,
            cost_price: Math.round(s.selling_price * 0.85),
            is_active: true,
            initial_stock: 1,
          },
        ]);
      }
    }
    if (s.gift_products?.length) {
      setSelectedGifts((prev) => {
        const ids = new Set(prev.map((g) => g.id));
        const merged = [...prev];
        for (const g of s.gift_products) {
          if (!ids.has(g.id)) merged.push(g);
        }
        return merged;
      });
    }
    setStatus("active");
  };

  const addVariantToForm = () => {
    if (!newSku) {
      toast.error("Vui lòng nhập SKU");
      return;
    }
    setVariants((prev) => [
      ...prev,
      {
        sku: newSku,
        name: newVarName || "Mặc định",
        selling_price: Number(newSellingPrice) || 0,
        cost_price: Number(newCostPrice) || 0,
        is_active: true,
        initial_stock: Number(newInitialStock) || 0,
      },
    ]);
    setNewSku("");
    setNewVarName("");
    setNewSellingPrice(0);
    setNewCostPrice(0);
    setNewInitialStock(0);
  };

  const setAsThumbnail = (url: string) => {
    setCoverUrl(url);
  };

  const removeUploadedImage = (url: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((f) => f.localUrl === url);
      if (target) {
        URL.revokeObjectURL(target.localUrl);
      }
      return prev.filter((f) => f.localUrl !== url);
    });

    if (thumbnailUrl === url) {
      setThumbnailUrl("");
    }
    if (coverUrl === url) {
      setCoverUrl("");
    }
  };

  const removeVariantFromForm = async (index: number, varId?: string) => {
    if (varId && editingProduct) {
      if (confirm("Bạn có chắc chắn muốn xoá biến thể này khỏi hệ thống?")) {
        try {
          await deleteVariant.mutateAsync(varId);
          toast.success("Đã xoá biến thể");
        } catch (err) {
          toast.error(getErrorMessage(err));
        }
      }
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name || !slug) {
      toast.error("Vui lòng điền Tên và Slug sản phẩm");
      return;
    }

    try {
      let finalThumbnail = thumbnailUrl;
      const uploadedMap = new Map<string, string>();

      if (selectedFiles.length > 0) {
        setUploading(true);
        const supabase = createClient();

        for (const item of selectedFiles) {
          const fileExt = item.file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = `products/${fileName}`;

          const { error } = await supabase.storage.from("product-images").upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: false,
          });
          if (error) throw new Error(`Lỗi tải ảnh ${item.file.name}: ${error.message}`);

          const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
          uploadedMap.set(item.localUrl, data.publicUrl);
        }
      }

      if (coverUrl) {
        finalThumbnail = uploadedMap.get(coverUrl) ?? coverUrl;
      }

      // Gallery: ảnh remote đã có + ảnh vừa upload (resolve từ localUrl → publicUrl).
      // Đưa ảnh đại diện (thumbnail) lên đầu, loại trùng.
      const uploadedUrls = selectedFiles
        .map((item) => uploadedMap.get(item.localUrl))
        .filter((u): u is string => Boolean(u));
      const galleryImages = Array.from(
        new Set(
          [finalThumbnail, ...existingImages, ...uploadedUrls].filter(
            (u): u is string => Boolean(u),
          ),
        ),
      );

      const productPayload = {
        name,
        slug,
        status,
        brand_id: brandId || null,
        category_id: categoryId || null,
        short_description: shortDesc || null,
        description: description || null,
        thumbnail_url: finalThumbnail || null,
        images: galleryImages.length > 0 ? galleryImages : null,
        tags: tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : null,
        gift_product_ids: selectedGifts.map((g) => g.id),
      };

      let savedProduct: Product;
      if (editingProduct) {
        savedProduct = await updateProduct.mutateAsync({ id: editingProduct.id, input: productPayload });
        toast.success("Đã cập nhật sản phẩm thành công");
      } else {
        savedProduct = await createProduct.mutateAsync(productPayload);
        toast.success("Đã tạo sản phẩm thành công");
      }

      // Nếu user KHÔNG thêm variant thủ công nhưng có nhập Giá nhanh,
      // tự tạo 1 variant mặc định (chỉ khi đang tạo mới — edit thì giữ nguyên)
      const variantsToSave =
        variants.length === 0 && !editingProduct && quickPrice !== "" && Number(quickPrice) > 0
          ? [
            {
              sku: slug || `SKU-${Date.now()}`,
              name: "Mặc định",
              selling_price: Number(quickPrice),
              cost_price: 0,
              is_active: true,
              initial_stock: quickStock === "" ? 0 : Number(quickStock),
            } as VariantInput,
          ]
          : variants;

      // Save variants song song cho nhanh — giữ tham chiếu (variant gốc, kết quả) để adjust stock sau
      const variantResults = await Promise.all(
        variantsToSave.map(async (variant) => {
          const variantPayload = {
            product_id: savedProduct.id,
            sku: variant.sku,
            name: variant.name,
            selling_price: Number(variant.selling_price),
            cost_price: Number(variant.cost_price),
            is_active: variant.is_active,
            // Specs chung của sản phẩm — chỉ gắn khi user CÓ điền và chỉ cho variant không có specs riêng
            specs: Object.keys(specValues).length ? specValues : undefined,
          };
          const saved = variant.id
            ? await updateVariant.mutateAsync({ id: variant.id, input: variantPayload })
            : await createVariant.mutateAsync(variantPayload);
          return { variant, saved };
        }),
      );

      // Ghi tồn kho ban đầu cho các variant mới (chỉ khi đang tạo product mới + có chọn kho + qty > 0).
      // Khi edit, người dùng nên dùng trang "Tồn kho" riêng để tránh ghi đè nhầm.
      if (!editingProduct && warehouseId) {
        const stockTasks = variantResults
          .map(({ variant, saved }) => {
            const qty = Number(variant.initial_stock) || 0;
            if (qty <= 0) return null;
            const savedRecord = saved as Record<string, unknown> | undefined;
            const variantId = savedRecord?.id as string | undefined;
            if (!variantId) return null;
            return fetch("/api/v1/stock-levels/adjust", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                warehouse_id: warehouseId,
                product_variant_id: variantId,
                available_qty: qty,
              }),
            }).then(async (res) => {
              if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error?.message ?? `Không ghi được tồn kho cho ${variant.sku}`);
              }
            });
          })
          .filter(Boolean) as Promise<void>[];

        if (stockTasks.length > 0) {
          try {
            await Promise.all(stockTasks);
            toast.success(`Đã ghi tồn kho ban đầu cho ${stockTasks.length} biến thể`);
          } catch (stockErr) {
            toast.error(getErrorMessage(stockErr));
          }
        }
      }

      for (const item of selectedFiles) {
        URL.revokeObjectURL(item.localUrl);
      }
      setSelectedFiles([]);
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl font-bold">Danh sách sản phẩm</CardTitle>
            <CardDescription>Sản phẩm được sắp theo phân loại, ưu tiên nhóm Laptop hiển thị đầu tiên.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm sản phẩm..."
              className="w-full sm:w-64"
            />
            <Button onClick={startCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* ===== Desktop: bảng đầy đủ (ẩn trên mobile) ===== */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">STT</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Mã/SKU đại diện</TableHead>
                  <TableHead>Thương hiệu</TableHead>
                  <TableHead>Danh mục</TableHead>

                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {productsQuery.isLoading ? "Đang tải dữ liệu..." : "Không tìm thấy sản phẩm nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedProducts.map((prod, index) => {
                    const b = prod.brand_id ? brandMap.get(prod.brand_id) : null;
                    const c = prod.category_id ? categoryMap.get(prod.category_id) : null;
                    const variantsCount = prod.variants_count ?? 0;
                    return (
                      <TableRow key={prod.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {prod.thumbnail_url ? (
                              <Image src={prod.thumbnail_url} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover border" />
                            ) : (
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center border text-[10px] text-muted-foreground">Ảnh</div>
                            )}
                            <div>
                              <div className="font-semibold">{prod.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{prod.short_description ?? "Chưa có mô tả ngắn"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{prod.slug ?? "-"}</TableCell>
                        <TableCell>{b ?? <span className="text-muted-foreground text-xs">Chưa chọn</span>}</TableCell>
                        <TableCell>{c ?? <span className="text-muted-foreground text-xs">Chưa chọn</span>}</TableCell>

                        <TableCell>
                          <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-semibold ${prod.status === "active" ? "bg-green-100 text-green-800" :
                              prod.status === "archived" ? "bg-gray-100 text-gray-800" : "bg-yellow-100 text-yellow-800"
                            }`}>
                            {prod.status === "active" ? "Đang bán" : prod.status === "archived" ? "Ngừng bán" : "Nháp"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => startEdit(prod)}>
                              <Edit className="h-4 w-4 mr-1" /> Sửa
                            </Button>
                            <ConfirmDeleteDialog
                              entity="products"
                              id={prod.id}
                              trigger={
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* ===== Mobile: danh sách card (ẩn trên desktop) ===== */}
          <div className="md:hidden space-y-3">
            {sortedProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {productsQuery.isLoading ? "Đang tải dữ liệu..." : "Không tìm thấy sản phẩm nào"}
              </div>
            ) : (
              sortedProducts.map((prod, index) => {
                const b = prod.brand_id ? brandMap.get(prod.brand_id) : null;
                const c = prod.category_id ? categoryMap.get(prod.category_id) : null;
                const variantsCount = prod.variants_count ?? 0;
                return (
                  <div key={prod.id} className="rounded-lg border bg-card p-3">
                    <div className="flex gap-3">
                      {prod.thumbnail_url ? (
                        <Image src={prod.thumbnail_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded object-cover border" />
                      ) : (
                        <div className="h-14 w-14 shrink-0 bg-muted rounded flex items-center justify-center border text-[10px] text-muted-foreground">Ảnh</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold leading-tight line-clamp-2">
                              <span className="text-muted-foreground">{index + 1}. </span>
                              {prod.name}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">{prod.slug ?? "-"}</div>
                          </div>
                          <span className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold ${prod.status === "active" ? "bg-green-100 text-green-800" :
                              prod.status === "archived" ? "bg-gray-100 text-gray-800" : "bg-yellow-100 text-yellow-800"
                            }`}>
                            {prod.status === "active" ? "Đang bán" : prod.status === "archived" ? "Ngừng bán" : "Nháp"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{b ?? "Chưa có thương hiệu"}</span>
                          <span>·</span>
                          <span>{c ?? "Chưa phân loại"}</span>
                          <span>·</span>
                          <span>{variantsCount} biến thể</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => startEdit(prod)}>
                        <Edit className="h-4 w-4 mr-1" /> Sửa
                      </Button>
                      <ConfirmDeleteDialog
                        entity="products"
                        id={prod.id}
                        trigger={
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
        {productsQuery.data && productsQuery.data.totalPages > 1 && (
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-xs sm:text-sm text-muted-foreground">
                Trang {productsQuery.data.page} / {productsQuery.data.totalPages} (Tổng {productsQuery.data.total} sản phẩm)
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={page >= (productsQuery.data?.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex flex-col gap-0 mx-0 w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-5xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>{editingProduct ? "Chỉnh sửa sản phẩm" : "Thêm mới sản phẩm toàn diện"}</DialogTitle>
            <DialogDescription className="hidden sm:block">
              Form tích hợp cho phép điền thông tin chung, chọn danh mục/thương hiệu và thêm biến thể cùng lúc.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {/* AI paste box — chỉ hiện khi tạo mới để tránh ghi đè nhầm khi edit */}
            {!editingProduct && <AIPasteBox onApply={applyAISuggestions} />}

            {/* ============================================================
                THÔNG TIN CƠ BẢN — luôn hiện. Đủ để tạo 1 sản phẩm đơn giản.
               ============================================================ */}
            <div className="space-y-4 rounded-lg border bg-card px-3 py-3 sm:px-4 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên sản phẩm <span className="text-destructive">*</span></Label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setName(nextName);
                      if (slugTouched) return;
                      const base = slugify(nextName);
                      if (!base) {
                        setSlug("");
                        return;
                      }
                      const existed = activeProducts.some((p) => p.slug === base && p.id !== editingProduct?.id);
                      setSlug(existed ? withDateSuffix(base) : base);
                    }}
                    placeholder="VD: Balo Targus 15.6 inch"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    placeholder="balo-targus-15-6-inch"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Danh mục</Label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={categoryId}
                    onValueChange={(v) => {
                      setCategoryId(v);
                      setTimeout(() => {
                        const inherited = findTemplateForCategory(v, specTemplates, categories);
                        if (inherited && !specTemplateId) setSpecTemplateId(inherited.id);
                      }, 0);
                    }}
                    placeholder="Chọn danh mục..."
                    searchPlaceholder="Tìm danh mục..."
                  />
                  {categoryId && (
                    <p className="text-xs text-muted-foreground">
                      {getAncestors(categoryId, categories)
                        .map((c) => c.name)
                        .reverse()
                        .join(" / ")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Thương hiệu</Label>
                  <SearchableSelect
                    options={brandOptions}
                    value={brandId}
                    onValueChange={setBrandId}
                    placeholder="Chọn (tuỳ chọn)..."
                    searchPlaceholder="Tìm thương hiệu..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn trạng thái..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Bản nháp (Draft)</SelectItem>
                      <SelectItem value="active">Kích hoạt (Active)</SelectItem>
                      <SelectItem value="archived">Lưu trữ (Archived)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ảnh đại diện — gọn hơn ở section cơ bản */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Hình ảnh sản phẩm</Label>
                  <Label
                    htmlFor="product-thumb-upload"
                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 px-3 text-xs font-medium border transition-colors"
                  >
                    {uploading ? "Đang tải..." : "Tải ảnh"}
                  </Label>
                  <Input
                    id="product-thumb-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </div>
                {imagePreviews.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground bg-muted/20">
                    Chưa có hình ảnh. Tải lên để bắt đầu — click ảnh để chọn làm đại diện.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                    {imagePreviews.map((imgUrl) => {
                      const isCover = imgUrl === coverUrl;
                      return (
                        <div
                          key={imgUrl}
                          className={`group relative rounded-md overflow-hidden border bg-card aspect-square cursor-pointer transition-all ${isCover ? "ring-2 ring-primary border-primary shadow-sm" : "hover:border-muted-foreground"
                            }`}
                          onClick={() => setAsThumbnail(imgUrl)}
                        >
                          <Image src={imgUrl} alt="" fill sizes="20vw" className="object-cover" />
                          {isCover && (
                            <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded font-semibold shadow">
                              Đại diện
                            </div>
                          )}
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUploadedImage(imgUrl);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Giá bán nhanh + Tồn kho + Cửa hàng + Kho — chỉ hiện khi tạo mới và chưa có variant chi tiết */}
              {!editingProduct && variants.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label className="whitespace-nowrap">Giá bán</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        value={quickPrice}
                        onChange={(e) => {
                          const v = e.target.value;
                          setQuickPrice(v === "" ? "" : Number(v));
                        }}
                        placeholder="VD: 350000"
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
                    </div>
                    {quickPrice !== "" && Number(quickPrice) > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        = {Number(quickPrice).toLocaleString("vi-VN")} đ
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Để trống → hiển thị <strong className="text-foreground">&quot;Giá liên hệ&quot;</strong>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="whitespace-nowrap">Tồn kho ban đầu</Label>
                    <Input
                      type="number"
                      min={0}
                      value={quickStock}
                      onChange={(e) => {
                        const v = e.target.value;
                        setQuickStock(v === "" ? "" : Number(v));
                      }}
                      placeholder="VD: 10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="whitespace-nowrap">Cửa hàng</Label>
                    <SearchableSelect
                      options={shopOptions}
                      value={shopId}
                      onValueChange={(v) => {
                        setShopId(v);
                        setWarehouseId(""); // reset để effect chọn lại kho đầu của cửa hàng mới
                      }}
                      placeholder="Chọn cửa hàng..."
                      searchPlaceholder="Tìm cửa hàng..."
                      disabled={myShops.length === 0}
                    />
                    {myShopsQuery.isLoading ? (
                      <p className="text-xs text-muted-foreground">Đang tải cửa hàng...</p>
                    ) : myShops.length === 0 ? (
                      <p className="text-xs text-amber-600">Tài khoản chưa được gán cửa hàng nào.</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="whitespace-nowrap">Kho hàng</Label>
                    <SearchableSelect
                      options={warehouseOptions}
                      value={warehouseId}
                      onValueChange={setWarehouseId}
                      placeholder="Chọn kho..."
                      searchPlaceholder="Tìm kho..."
                      disabled={warehouses.length === 0}
                    />
                    {warehouses.length === 0 && (
                      <p className="text-xs text-amber-600">
                        {shopId ? "Cửa hàng này chưa có kho." : "Chưa có kho — tạo ở mục Kho hàng trước."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================
                MÔ TẢ & TỪ KHÓA — collapsible
               ============================================================ */}
            <Section
              title="Mô tả & Từ khóa"
              description="Mô tả ngắn, mô tả chi tiết, tags"
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              badge={[shortDesc, description, tagsInput].filter(Boolean).length || null}
              defaultOpen={Boolean(editingProduct && (shortDesc || description || tagsInput))}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mô tả ngắn</Label>
                  <Input value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="Một dòng giới thiệu sản phẩm..." />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Mô tả chi tiết <span className="text-xs text-muted-foreground font-normal">(hỗ trợ HTML)</span></Label>
                    <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setDescriptionTab("edit")}
                        className={`px-2.5 py-1 rounded ${descriptionTab === "edit" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescriptionTab("preview")}
                        className={`px-2.5 py-1 rounded ${descriptionTab === "preview" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}
                      >
                        Xem trước
                      </button>
                    </div>
                  </div>
                  {descriptionTab === "edit" ? (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder='Có thể paste HTML từ AI hoặc viết tay. VD: <h3>Cấu hình</h3><ul><li>CPU: i7-1255U</li></ul>'
                      className="flex min-h-[160px] sm:min-h-[260px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  ) : description ? (
                    <div
                      className="product-description-preview min-h-[160px] sm:min-h-[260px] rounded-md border bg-card px-4 py-3 text-sm"
                      dangerouslySetInnerHTML={{ __html: description }}
                    />
                  ) : (
                    <div className="min-h-[160px] sm:min-h-[260px] rounded-md border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground flex items-center justify-center">
                      Chưa có nội dung mô tả — chuyển sang &quot;Chỉnh sửa&quot; để viết.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Thẻ (Tags)</Label>
                  <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="laptop, dell, xps" />
                  <div className="flex flex-wrap gap-2">
                    {TAG_SUGGESTIONS.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const current = tagsInput
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean);
                          if (!current.includes(tag)) {
                            setTagsInput([...current, tag].join(", "));
                          }
                        }}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================
                THÔNG SỐ KỸ THUẬT — collapsible, ẩn cho sản phẩm đơn giản
               ============================================================ */}
            <Section
              title="Thông số kỹ thuật"
              description="Chỉ cần điền cho laptop / linh kiện. Sản phẩm đơn giản có thể bỏ qua."
              icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
              badge={Object.values(specValues).filter(Boolean).length || null}
              defaultOpen={Boolean(editingProduct && specTemplateId)}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mẫu thông số (Spec template)</Label>
                  <SearchableSelect
                    options={specTemplateOptions}
                    value={specTemplateId}
                    onValueChange={setSpecTemplateId}
                    placeholder="Chọn mẫu specs..."
                    searchPlaceholder="Tìm mẫu thông số..."
                  />
                  {inheritedTemplate && !specTemplateId && (
                    <p className="text-xs text-muted-foreground">
                      Gợi ý kế thừa từ
                      {inheritedFromName ? <> danh mục cha <strong className="text-foreground">{inheritedFromName}</strong>:</> : ":"}{" "}
                      <button
                        type="button"
                        className="underline underline-offset-2 text-foreground hover:opacity-80"
                        onClick={() => setSpecTemplateId(inheritedTemplate.id)}
                      >
                        Áp dụng {inheritedTemplate.name}
                      </button>
                    </p>
                  )}
                  {inheritedTemplate && specTemplateId === inheritedTemplate.id && inheritedFromName && (
                    <p className="text-xs text-muted-foreground">
                      Đang dùng template kế thừa từ <strong className="text-foreground">{inheritedFromName}</strong>.
                    </p>
                  )}
                </div>

                {templateFields.length === 0 ? (
                  <div className="text-xs text-muted-foreground border rounded-md p-3">
                    Chọn Spec template ở trên để hiện các trường thông số (RAM, VGA, trọng lượng, cổng kết nối...).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {templateFields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label ?? field.key}</Label>
                        <Input
                          value={specValues[field.key] ?? ""}
                          onChange={(e) => setSpecValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={`Nhập ${field.label ?? field.key}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* ============================================================
                QUÀ TẶNG KÈM — collapsible
               ============================================================ */}
            <Section
              title="Quà tặng kèm"
              description="Chọn sản phẩm khác làm quà tặng khi bán sản phẩm này"
              icon={<Gift className="h-4 w-4 text-muted-foreground" />}
              badge={selectedGifts.length || null}
              defaultOpen={selectedGifts.length > 0}
            >
              <GiftProductPicker
                excludeProductId={editingProduct?.id}
                value={selectedGifts}
                onChange={setSelectedGifts}
              />
            </Section>

            {/* ============================================================
                BIẾN THỂ NHIỀU CẤU HÌNH — collapsible, override quick price
               ============================================================ */}
            <Section
              title="Biến thể nhiều cấu hình"
              description="Cần khi sản phẩm có nhiều phiên bản (i5/i7, 16GB/32GB...). Bỏ qua nếu sản phẩm đơn giản."
              icon={<Layers3 className="h-4 w-4 text-muted-foreground" />}
              badge={variants.length || null}
              defaultOpen={variants.length > 0}
            >
              <div className="space-y-3">
                {!editingProduct && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Cửa hàng</Label>
                      <SearchableSelect
                        options={shopOptions}
                        value={shopId}
                        onValueChange={(v) => {
                          setShopId(v);
                          setWarehouseId("");
                        }}
                        placeholder="Chọn cửa hàng..."
                        searchPlaceholder="Tìm cửa hàng..."
                        disabled={myShops.length === 0}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kho hàng (nhập tồn ban đầu cho biến thể)</Label>
                      <SearchableSelect
                        options={warehouseOptions}
                        value={warehouseId}
                        onValueChange={setWarehouseId}
                        placeholder="Chọn kho..."
                        searchPlaceholder="Tìm kho..."
                        disabled={warehouses.length === 0}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-muted/40 p-3 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="text-xs">SKU</Label>
                    <Input size={1} value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="DELL-XPS13-I7" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tên cấu hình</Label>
                    <Input size={1} value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="i7/16GB/512GB" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Giá bán</Label>
                    <Input type="number" value={newSellingPrice} onChange={(e) => setNewSellingPrice(Number(e.target.value))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Giá vốn</Label>
                    <Input type="number" value={newCostPrice} onChange={(e) => setNewCostPrice(Number(e.target.value))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tồn ban đầu</Label>
                    <Input type="number" min={0} value={newInitialStock} onChange={(e) => setNewInitialStock(Number(e.target.value))} className="h-8" />
                  </div>
                  <Button size="sm" type="button" onClick={addVariantToForm} className="h-8 col-span-2 sm:col-span-5 w-full sm:w-auto sm:justify-self-start">
                    <Plus className="h-4 w-4 mr-1" /> Thêm biến thể
                  </Button>
                </div>

                {variants.length > 0 && quickPrice !== "" && !editingProduct && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Đã có biến thể chi tiết — &quot;Giá bán nhanh&quot; ở trên sẽ bị bỏ qua.
                  </p>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Tên cấu hình</TableHead>
                        <TableHead>Giá bán</TableHead>
                        <TableHead>Giá vốn</TableHead>
                        <TableHead>Tồn ban đầu</TableHead>
                        <TableHead className="text-right">Xoá</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-xs">
                            Chưa có cấu hình biến thể nào được thêm
                          </TableCell>
                        </TableRow>
                      ) : (
                        variants.map((v, i) => (
                          <TableRow key={v.sku + i}>
                            <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                            <TableCell>{v.name}</TableCell>
                            <TableCell className="text-sm font-semibold">{v.selling_price.toLocaleString()}đ</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{v.cost_price.toLocaleString()}đ</TableCell>
                            <TableCell>
                              {editingProduct ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  value={v.initial_stock ?? 0}
                                  onChange={(e) => {
                                    const qty = Number(e.target.value) || 0;
                                    setVariants((prev) => prev.map((row, idx) => (idx === i ? { ...row, initial_stock: qty } : row)));
                                  }}
                                  className="h-8 w-20"
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeVariantFromForm(i, v.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Section>
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:gap-2 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Huỷ</Button>
            <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" /> {editingProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
