import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { AppProviders } from '~/providers';
import { createAppQueryClient } from '~/shared/query-client';
import { vi } from 'vitest';

it('reuses fresh reads, revalidates stale or invalidated reads and preserves unchanged data', async () => {
  const client = createAppQueryClient();
  let now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
  try {
    const queryFn = vi.fn(() => Promise.resolve({ names: ['Colombo'] }));
    const key = ['admin-zones', 'actor-a'];
    const first = await client.fetchQuery({ queryKey: key, queryFn });
    now += 60_000;
    expect(await client.fetchQuery({ queryKey: key, queryFn })).toBe(first);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await client.invalidateQueries({ queryKey: key });
    await client.fetchQuery({ queryKey: key, queryFn });
    expect(client.getQueryData(key)).toBe(first);
    expect(queryFn).toHaveBeenCalledTimes(2);
    now += 5 * 60_000 + 1;
    await client.fetchQuery({ queryKey: key, queryFn });
    expect(queryFn).toHaveBeenCalledTimes(3);
    await client.fetchQuery({ queryKey: ['admin-zones', 'actor-b'], queryFn });
    expect(queryFn).toHaveBeenCalledTimes(4);
    client.clear();
    expect(client.getQueryData(key)).toBeUndefined();
  } finally {
    clock.mockRestore();
    client.clear();
  }
});

function CacheProbe({ onClient }: { onClient: (client: QueryClient) => void }) {
  const client = useQueryClient();
  useEffect(() => onClient(client), [client, onClient]);
  return null;
}

it('keeps query caches isolated between application instances', () => {
  const clients: QueryClient[] = [];
  const onClient = (client: QueryClient) => {
    clients.push(client);
  };
  const first = render(
    <AppProviders>
      <CacheProbe onClient={onClient} />
    </AppProviders>,
  );
  clients[0]!.setQueryData(['private-data'], 'first instance only');
  first.unmount();

  render(
    <AppProviders>
      <CacheProbe onClient={onClient} />
    </AppProviders>,
  );
  expect(clients).toHaveLength(2);
  expect(clients[1]).not.toBe(clients[0]);
  expect(clients[1]!.getQueryData(['private-data'])).toBeUndefined();
});
