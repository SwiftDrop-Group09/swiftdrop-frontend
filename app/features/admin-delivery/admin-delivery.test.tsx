import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AdminNav } from './admin-nav';
import { AdminDeliveryError } from './api';
import {
  zoneInputSchema,
  pricingTierInputSchema,
  dailyReportMetricSchema,
  deliveryReportResponseSchema,
} from './contracts';

describe('AdminNav', () => {
  it('renders all four admin sub-navigation links', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/admin/zones',
          element: <AdminNav />,
        },
      ],
      { initialEntries: ['/admin/zones'] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /delivery zones/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pricing configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /delivery reports/i })).toBeInTheDocument();
  });
});

describe('AdminDeliveryError', () => {
  it('resolves standard error codes correctly', () => {
    expect(new AdminDeliveryError('forbidden').message).toContain('Administrator');
    expect(new AdminDeliveryError('overlapping_postal_codes').message).toContain('overlap');
    expect(new AdminDeliveryError('invalid_date_range').message).toContain('date range is invalid');
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

