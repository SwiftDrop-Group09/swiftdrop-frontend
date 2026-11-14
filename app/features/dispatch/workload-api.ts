import { z } from 'zod';
import type { AuthenticatedRequest } from '~/features/identity/contracts';

const count = z.number().int().nonnegative();
const paging = {
  totalCount: count,
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
};

export const workloadPageSchema = z.object({
  items: z.array(
    z.object({
      courierId: z.uuid(),
      active: z.boolean(),
      onDuty: z.boolean(),
      activeCount: count,
      capacity: z.number().int().positive(),
      zoneIds: z.array(z.uuid()),
    }),
  ),
  ...paging,
});

export const dispatchAssignmentsSchema = z.object({
  courierId: z.uuid(),
  items: z.array(
    z.object({
      parcelId: z.uuid(),
      trackingNumber: z.string().min(1),
      status: z.enum([
        'Created',
        'Assigned',
        'PickedUp',
        'InTransit',
        'OutForDelivery',
        'Delivered',
        'Failed',
        'Cancelled',
      ]),
      serviceDate: z.iso.date(),
      assignedAt: z.iso.datetime({ offset: true }),
    }),
  ),
  ...paging,
});

export type WorkloadPage = z.infer<typeof workloadPageSchema>;
export type CourierWorkload = WorkloadPage['items'][number];
export type DispatchAssignmentsPage = z.infer<typeof dispatchAssignmentsSchema>;

export class DispatchReadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super('Delivery information could not be loaded.');
  }
}

async function read<T>(
  request: AuthenticatedRequest,
  url: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await request(url, { signal, cache: 'no-store' });
  const body: unknown = await response.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  if (!response.ok) {
    const problem = z.object({ code: z.string().optional() }).safeParse(body);
    throw new DispatchReadError(
      response.status,
      problem.success ? (problem.data.code ?? 'unexpected') : 'unexpected',
    );
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new DispatchReadError(response.status, 'invalid_response');
  return result.data;
}

export function listCourierWorkload(
  request: AuthenticatedRequest,
  apiBase: string,
  page: number,
  signal?: AbortSignal,
) {
  return read(
    request,
    `${apiBase}/v1/couriers/workload?page=${page}&pageSize=20`,
    workloadPageSchema,
    signal,
  );
}

export async function listDispatchAssignments(
  request: AuthenticatedRequest,
  apiBase: string,
  courierId: string,
  page: number,
  signal?: AbortSignal,
) {
  const result = await read(
    request,
    `${apiBase}/v1/couriers/${encodeURIComponent(courierId)}/assignments?page=${page}&pageSize=20`,
    dispatchAssignmentsSchema,
    signal,
  );
  if (result.courierId !== courierId)
    throw new DispatchReadError(200, 'invalid_response');
  return result;
}
