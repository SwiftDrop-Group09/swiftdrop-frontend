import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '~/features/identity/contracts';
import { json } from '~/features/identity/test-fixtures';
import {
  DispatchReadError,
  listCourierWorkload,
  listDispatchAssignments,
  readCourierDirectory,
} from './workload-api';

const courierId = '00000000-0000-4000-8000-000000000010';
const page = { items: [], page: 1, pageSize: 20, totalCount: 0 };

describe('Dispatch workload transport', () => {
  it('resolves only requested courier names and rejects unrelated directory entries', async () => {
    const request = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValueOnce(
        json([{ id: courierId, fullName: 'Kasun Silva' }]),
      );
    expect(await readCourierDirectory(request, '/api', [courierId])).toEqual({
      [courierId]: 'Kasun Silva',
    });
    expect(request.mock.calls[0]![0]).toContain(
      '/users/courier-directory?ids=',
    );
    request.mockResolvedValueOnce(
      json([
        {
          id: '00000000-0000-4000-8000-000000000020',
          fullName: 'Unrelated actor',
        },
      ]),
    );
    await expect(
      readCourierDirectory(request, '/api', [courierId]),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('passes authenticated reads, pagination, no-store and cancellation through to transport', async () => {
    const request = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValueOnce(json(page))
      .mockResolvedValueOnce(json({ ...page, courierId }));
    const signal = new AbortController().signal;
    await listCourierWorkload(request, '/api', 2, signal);
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/v1/couriers/workload?page=2&pageSize=20',
      { cache: 'no-store', signal },
    );
    await listDispatchAssignments(request, '/api', courierId, 3, signal);
    expect(request).toHaveBeenNthCalledWith(
      2,
      `/api/v1/couriers/${courierId}/assignments?page=3&pageSize=20`,
      { cache: 'no-store', signal },
    );
  });

  it('rejects malformed responses instead of fabricating successful counts', async () => {
    const request = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValue(
        json({ ...page, items: [{ courierId, activeCount: -1 }] }),
      );
    await expect(listCourierWorkload(request, '/api', 1)).rejects.toMatchObject(
      { code: 'invalid_response' },
    );
  });

  it('rejects a response belonging to another courier', async () => {
    const request = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValue(
        json({ ...page, courierId: '00000000-0000-4000-8000-000000000020' }),
      );
    await expect(
      listDispatchAssignments(request, '/api', courierId, 1),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('preserves missing-courier and unavailable errors without exposing server diagnostics', async () => {
    const request = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValueOnce(
        json({ code: 'not_found', detail: 'private diagnostic' }, 404),
      )
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    const result = listDispatchAssignments(request, '/api', courierId, 1);
    await expect(result).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
    await expect(result).rejects.not.toThrow('private diagnostic');
    await expect(
      listCourierWorkload(request, '/api', 1),
    ).rejects.toBeInstanceOf(DispatchReadError);
  });
});
