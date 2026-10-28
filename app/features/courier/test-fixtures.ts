import { parseExactJson } from '~/shared/exact-json';
import { detailSchema } from './api';
export const id = '00000000-0000-4000-8000-000000000011';
export function raw(status = 'Assigned', version = 2) {
  return {
    id,
    trackingNumber: 'SD-TEST',
    status,
    version,
    priceSnapshot: { total: 540, currency: 'LKR', pricingVersion: 'test-v1' },
    createdAt: '2026-10-28T10:00:00Z',
  };
}
export function privateRaw(status = 'Assigned', version = 2) {
  return {
    ...raw(status, version),
    pickupAddress: {
      street: 'Pickup street',
      city: 'Colombo',
      postalCode: '00100',
      zoneId: id,
    },
    deliveryAddress: {
      street: 'Delivery street',
      city: 'Galle',
      postalCode: '80000',
      zoneId: id,
    },
    recipient: { name: 'Test Recipient', phoneNumber: '0000000000' },
    packageDetails: { weightKg: 2.5, size: 'Small' },
    assignment: {
      status: 'Active',
      serviceDate: '2026-10-29',
      assignedAt: '2026-10-28T11:00:00Z',
      pickedUpAt: null,
      deliveredAt: null,
    },
    history: [
      {
        fromStatus: 'Created',
        toStatus: 'Assigned',
        changeReason: 'Assigned by dispatcher',
        deliveryNote: null,
        timestamp: '2026-10-28T11:00:00Z',
      },
    ],
    serviceDate: '2026-10-29',
    isOverdue: false,
  };
}
export const detail = (status = 'Assigned', version = 2) =>
  detailSchema.parse(
    parseExactJson(JSON.stringify(privateRaw(status, version))),
  );
export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
export const page = (items: unknown[]) => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 20,
});
