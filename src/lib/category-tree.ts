/**
 * Helpers cho cây danh mục — dùng chung cho các trang admin.
 *
 * "Kế thừa template từ cha": Spec template được gắn cho 1 category cha
 * sẽ được áp dụng cho mọi danh mục con qua hàm `findTemplateForCategory`.
 */

export type MinimalCategory = {
  id: string;
  name: string;
  parent_id: string | null;
  position?: number | null;
};

export type CategoryTreeNode<T extends MinimalCategory = MinimalCategory> = T & {
  depth: number;
};

const sortFn = (a: MinimalCategory, b: MinimalCategory) => {
  const pa = a.position ?? 0;
  const pb = b.position ?? 0;
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name, "vi");
};

/** Phẳng hoá danh sách thành dạng cây — cha trước con, kèm depth để render thụt lề. */
export function buildCategoryTree<T extends MinimalCategory>(
  items: T[],
): CategoryTreeNode<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const c of items) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const arr of byParent.values()) arr.sort(sortFn);

  const validIds = new Set(items.map((c) => c.id));
  const out: CategoryTreeNode<T>[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      if (visited.has(c.id)) continue;
      visited.add(c.id);
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);

  for (const c of items) {
    if (visited.has(c.id)) continue;
    if (c.parent_id && !validIds.has(c.parent_id)) {
      visited.add(c.id);
      out.push({ ...c, depth: 0 });
      walk(c.id, 1);
    }
  }
  return out;
}

/** Trả về tập id của node và toàn bộ hậu duệ (để loại khỏi dropdown chọn cha). */
export function getDescendantIds(
  rootId: string,
  items: MinimalCategory[],
): Set<string> {
  const out = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of items) {
      if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) {
        out.add(c.id);
        changed = true;
      }
    }
  }
  return out;
}

/** Trả về tổ tiên từ node lên đến root, bao gồm chính node đó. [self, parent, grand...]. */
export function getAncestors<T extends MinimalCategory>(
  categoryId: string,
  items: T[],
): T[] {
  const byId = new Map(items.map((c) => [c.id, c]));
  const out: T[] = [];
  let cur = byId.get(categoryId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    if (!cur.parent_id) break;
    cur = byId.get(cur.parent_id);
  }
  return out;
}

/**
 * Tìm spec template "kế thừa" cho 1 category:
 * - Ưu tiên template gắn trực tiếp với category đó.
 * - Nếu không có, đi ngược lên cha → ông → ... lấy template gần nhất.
 *
 * Trả về template phù hợp hoặc null.
 */
export function findTemplateForCategory<
  T extends { id: string; category_id: string | null },
>(
  categoryId: string | null,
  templates: T[],
  categories: MinimalCategory[],
): T | null {
  if (!categoryId) return null;
  const ancestors = getAncestors(categoryId, categories);
  for (const ancestor of ancestors) {
    const found = templates.find((t) => t.category_id === ancestor.id);
    if (found) return found;
  }
  return null;
}

/** Trả về tên danh mục kèm dấu mũi tên thụt cấp, dùng trong dropdown phẳng. */
export function indentedName(name: string, depth: number) {
  if (depth <= 0) return name;
  return `${"  ".repeat(depth - 1)}↳ ${name}`;
}
