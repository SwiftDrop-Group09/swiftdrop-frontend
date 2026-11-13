import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AdminNav } from './admin-nav';
import { AdminDeliveryError, createAdminDeliveryApi } from './api';
import { getUtcDatePreset, getUtcIsoRange } from './report-date-range';
import { IdentityApi } from '../identity/api';
import { IdentitySession } from '../identity/session';
import { describe, expect, it } from 'vitest';
import { AdminDeliveryError } from './api';
import {
  zoneInputSchema,
  pricingTierInputSchema,
  deliveryReportResponseSchema,
} from './contracts';

describe('AdminDeliveryError', () => {
  it('resolves standard error codes correctly', () => {
    expect(new AdminDeliveryError('forbidden').message).toContain(
      'Administrator',
    );
    expect(
      new AdminDeliveryError('overlapping_postal_codes').message,
    ).toContain('overlap');
    expect(new AdminDeliveryError('invalid_date_range').message).toContain(
      'date range is invalid',
    );
  });

  it('prioritizes field errors when provided', () => {
    const err = new AdminDeliveryError('validation', 400, {
      name: ['Zone name is required.'],
    });
    expect(err.message).toBe('Zone name is required.');
  });
});

describe('Contracts & Validation Schemas', () => {
  it('validates zone input schema', () => {
    const valid = zoneInputSchema.safeParse({
      name: 'Colombo South',
      city: 'Colombo',
      servicePostalCodes: ['00100', '00200'],
      isActive: true,
    });
    expect(valid.success).toBe(true);

    const emptyName = zoneInputSchema.safeParse({
      name: '   ',
    });
    expect(emptyName.success).toBe(false);
  });

  it('validates pricing tier input schema', () => {
    const valid = pricingTierInputSchema.safeParse({
      zoneId: '2b43d56e-bc0f-4b67-b15a-fb71d823c76b',
      size: 'Small',
      pricingVersion: 'v1',
      baseRate: 450,
      perKgRate: 60,
      currency: 'LKR',
      isActive: true,
    });
    expect(valid.success).toBe(true);

    const negativeBase = pricingTierInputSchema.safeParse({
      zoneId: '2b43d56e-bc0f-4b67-b15a-fb71d823c76b',
      size: 'Small',
      pricingVersion: 'v1',
      baseRate: -10,
      perKgRate: 60,
      currency: 'LKR',
    });
    expect(negativeBase.success).toBe(false);
  });

  it('validates delivery report response schema', () => {
    const reportData = {
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
      delivered: 10,
      failed: 2,
      cancelled: 1,
      terminalCount: 12,
      successRate: 0.8333,
      failureRate: 0.1667,
      days: [
        {
          date: '2026-10-01',
          delivered: 5,
          failed: 1,
          cancelled: 0,
        },
      ],
    };

    const valid = deliveryReportResponseSchema.safeParse(reportData);
    expect(valid.success).toBe(true);
  });
});

describe('Admin delivery API', () => {
  it('surfaces network failures instead of returning demo data', async () => {
    const session = new IdentitySession(new IdentityApi());
    vi.spyOn(session, 'authenticatedRequest').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    await expect(createAdminDeliveryApi(session).listZones()).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('preserves backend validation errors for configuration requests', async () => {
    const session = new IdentitySession(new IdentityApi());
    vi.spyOn(session, 'authenticatedRequest').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'validation',
          errors: { name: ['Zone name is required.'] },
        }),
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    await expect(
      createAdminDeliveryApi(session).createZone({
        name: '',
        servicePostalCodes: [],
        isActive: true,
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      status: 400,
      errors: { name: ['Zone name is required.'] },
    });
  });
});

describe('Delivery report date ranges', () => {
  it('uses the requested number of inclusive UTC calendar days', () => {
    expect(getUtcDatePreset(1, new Date('2026-11-12T12:00:00Z'))).toEqual({
      startDate: '2026-11-12',
      endDate: '2026-11-12',
    });
    expect(getUtcDatePreset(7, new Date('2026-11-12T12:00:00Z'))).toEqual({
      startDate: '2026-11-06',
      endDate: '2026-11-12',
    });

    expect(getUtcIsoRange('2024-01-01', '2024-01-07')).toEqual({
      fromUtc: '2024-01-01T00:00:00.000Z',
      toUtc: '2024-01-08T00:00:00.000Z',
      isValid: true,
    });
  });

  it('rejects invalid calendar dates, reversed ranges, and ranges over 366 days', () => {
    expect(getUtcIsoRange('2024-02-31', '2024-03-01').isValid).toBe(false);
    expect(getUtcIsoRange('2024-03-02', '2024-03-01').isValid).toBe(false);
    expect(getUtcIsoRange('2024-01-01', '2025-01-01').isValid).toBe(false);
  });
});

