export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductCursor = { productId: string; variantId: string };
export type ProductItem = {
  id: string;
  variant_id: string;
  [key: string]: unknown;
};
export type Query = <T>(
  sql: string,
  values: unknown[],
) => Promise<{ rows: T[] }>;

export function parseProductLimit(value: string | null): number | null {
  if (value === null) return 20;
  if (!/^\d+$/.test(value)) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 50
    ? limit
    : null;
}

export function parseProductCursor(
  value: string | null,
): ProductCursor | null | false {
  if (value === null) return null;
  const parts = value.split(":");
  if (parts.length !== 2 || !parts.every((part) => uuidPattern.test(part)))
    return false;
  return { productId: parts[0], variantId: parts[1] };
}

export async function listProducts(
  query: Query,
  limit: number,
  cursor: ProductCursor | null,
) {
  const result = await query<ProductItem>(
    `
    SELECT p.id,p.slug,p.name,p.category,v.id AS variant_id,v.sku,v.model,v.price_minor,v.currency
      FROM products p JOIN product_variants v ON v.product_id=p.id
     WHERE p.published AND v.published
       AND ($1::uuid IS NULL OR (p.id,v.id)>($1::uuid,$2::uuid))
     ORDER BY p.id,v.id
     LIMIT $3`,
    [cursor?.productId ?? null, cursor?.variantId ?? null, limit + 1],
  );
  const hasMore = result.rows.length > limit;
  const items = result.rows.slice(0, limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      hasMore && lastItem ? `${lastItem.id}:${lastItem.variant_id}` : null,
  };
}
