import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
} from '../workspaces';
import { mockWorkspace } from '../../test/mocks';

const BASE_URL = 'http://localhost:8000';

describe('workspaces API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listWorkspaces sends GET and returns array', async () => {
    const workspaces = [mockWorkspace()];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(workspaces),
    });

    const result = await listWorkspaces('tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/workspaces`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
    });
    expect(result).toEqual(workspaces);
  });

  it('getWorkspace sends GET with slug', async () => {
    const ws = mockWorkspace();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(ws),
    });

    const result = await getWorkspace('acme-corp', 'tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/workspaces/acme-corp`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
    });
    expect(result).toEqual(ws);
  });

  it('createWorkspace sends POST with body', async () => {
    const data = { name: 'New Corp', slug: 'new-corp' };
    const created = mockWorkspace({ name: 'New Corp', slug: 'new-corp' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(created),
    });

    const result = await createWorkspace(data, 'tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify(data),
    });
    expect(result).toEqual(created);
  });

  it('updateWorkspace sends PUT with body', async () => {
    const data = { name: 'Renamed Corp' };
    const updated = mockWorkspace({ name: 'Renamed Corp' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(updated),
    });

    const result = await updateWorkspace('acme-corp', data, 'tok');

    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/workspaces/acme-corp`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify(data),
    });
    expect(result).toEqual(updated);
  });
});
