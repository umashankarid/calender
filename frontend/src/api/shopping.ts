import type { ShoppingItem } from '../types';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export async function listShoppingItems(
  slug: string,
  token: string,
  isBought?: boolean,
): Promise<ShoppingItem[]> {
  const query = new URLSearchParams();
  if (isBought !== undefined) query.set('is_bought', String(isBought));
  const qs = query.toString();
  return apiGet<ShoppingItem[]>(
    `/api/workspaces/${slug}/shopping/${qs ? `?${qs}` : ''}`,
    token,
  );
}

export async function addShoppingItem(
  slug: string,
  data: { name: string; quantity?: string; category?: string },
  token: string,
): Promise<ShoppingItem> {
  return apiPost<ShoppingItem>(
    `/api/workspaces/${slug}/shopping/`,
    data,
    token,
  );
}

export async function updateShoppingItem(
  slug: string,
  itemId: string,
  data: Partial<{ name: string; quantity: string | null; category: string | null; is_bought: boolean }>,
  token: string,
): Promise<ShoppingItem> {
  return apiPut<ShoppingItem>(
    `/api/workspaces/${slug}/shopping/${itemId}`,
    data,
    token,
  );
}

export async function toggleShoppingItem(
  slug: string,
  itemId: string,
  token: string,
): Promise<ShoppingItem> {
  return apiPut<ShoppingItem>(
    `/api/workspaces/${slug}/shopping/${itemId}/toggle`,
    {},
    token,
  );
}

export async function deleteShoppingItem(
  slug: string,
  itemId: string,
  token: string,
): Promise<void> {
  return apiDelete(`/api/workspaces/${slug}/shopping/${itemId}`, token);
}

export async function clearBoughtItems(
  slug: string,
  token: string,
): Promise<void> {
  return apiDelete(`/api/workspaces/${slug}/shopping/bought`, token);
}
