import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { AppProviders } from '~/providers';

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
