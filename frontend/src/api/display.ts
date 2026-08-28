import type { Display, DisplayFeed } from '../types';
import { apiGet, apiPost } from './client';

/**
 * Fetch the display feed using a display token (no JWT required).
 */
export async function getDisplayFeed(
  slug: string,
  token_string: string,
): Promise<DisplayFeed> {
  return apiGet<DisplayFeed>(
    `/api/workspaces/${slug}/displays/by-token/${token_string}/today`,
  );
}

export async function listDisplays(
  slug: string,
  token: string,
): Promise<Display[]> {
  return apiGet<Display[]>(`/api/workspaces/${slug}/displays`, token);
}

export async function createDisplay(
  slug: string,
  data: { name: string; layout?: string },
  token: string,
): Promise<Display> {
  return apiPost<Display>(
    `/api/workspaces/${slug}/displays`,
    data,
    token,
  );
}

/**
 * Pair a display using a pairing code (no JWT required).
 */
export async function pairDisplay(
  slug: string,
  code: string,
): Promise<Display> {
  return apiPost<Display>(
    `/api/workspaces/${slug}/displays/pair`,
    { pairing_code: code },
  );
}
