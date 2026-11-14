import { QueryClient } from '@tanstack/react-query';

// Private data stays in this application instance, never browser storage.
export function createAppQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 15 * 60_000,
        retry: false,
      },
      mutations: { retry: false },
    },
  });
  for (const key of [
    'admin-zones',
    'admin-zones-all',
    'customer-booking',
    'admin-pricing',
    'courier-directory',
  ])
    client.setQueryDefaults([key], { staleTime: 5 * 60_000 });
  for (const key of [
    'customer-parcels',
    'customer-parcel',
    'dispatch-workload',
    'dispatch-assignments',
    'courier-assignments',
    'delivery-zone-summary',
  ])
    client.setQueryDefaults([key], { staleTime: 30_000 });
  return client;
}
