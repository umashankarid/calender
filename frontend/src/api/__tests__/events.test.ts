import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../events';
import { mockEvent } from '../../test/mocks';

const BASE_URL = 'http://localhost:8000';

describe('events API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listEvents builds correct URL with no params', async () => {
    const events = [mockEvent()];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(events),
    });

    const result = await listEvents('acme-corp', undefined, 'tok');

    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/workspaces/acme-corp/events`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(events);
  });

  it('listEvents builds URL with start/end params', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    await listEvents(
      'acme-corp',
      { start: '2026-08-01', end: '2026-08-31' },
      'tok',
    );

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('start=2026-08-01');
    expect(calledUrl).toContain('end=2026-08-31');
  });

  it('listEvents builds URL with calendar_id param', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    await listEvents('acme-corp', { calendar_id: 'cal-1' }, 'tok');

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('calendar_id=cal-1');
  });

  it('createEvent sends POST with correct body', async () => {
    const eventData = { title: 'New Event', start: '2026-09-01T10:00:00Z' };
    const created = mockEvent({ title: 'New Event' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(created),
    });

    const result = await createEvent('acme-corp', eventData, 'tok');

    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/workspaces/acme-corp/events`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(eventData),
      }),
    );
    expect(result).toEqual(created);
  });

  it('updateEvent sends PUT with correct body', async () => {
    const updateData = { title: 'Updated Event' };
    const updated = mockEvent({ title: 'Updated Event' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(updated),
    });

    const result = await updateEvent('acme-corp', 'evt-1', updateData, 'tok');

    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/workspaces/acme-corp/events/evt-1`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(updateData),
      }),
    );
    expect(result).toEqual(updated);
  });

  it('deleteEvent sends DELETE', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('No body')),
    });

    await deleteEvent('acme-corp', 'evt-1', 'tok');

    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/workspaces/acme-corp/events/evt-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
