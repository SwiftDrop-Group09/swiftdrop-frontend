import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportPeriod } from './report-period';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('Calendar reporting periods', () => {
  it('keeps existing report inputs and defaults without opt-in props', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportPeriod
        value={{ startDate: '2026-11-01', endDate: '2026-11-14' }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Reporting period' }));
    expect(screen.getByLabelText('From (UTC)')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Through (UTC)')).toHaveValue('2026-11-14');
    expect(screen.queryByRole('button', { name: 'Clear dates' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects Calendar dates with the keyboard, applies once, and clears to all dates', async () => {
    const onChange = vi.fn();
    function Example() {
      const [value, setValue] = useState<{
        startDate: string;
        endDate: string;
      } | null>(null);
      return (
        <ReportPeriod
          allowAllDates
          inputMode="calendar"
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const period = screen.getByRole('button', { name: 'Reporting period' });
    expect(period).toHaveTextContent('All booking dates');
    await user.click(period);
    for (const label of ['From (UTC)', 'Through (UTC)']) {
      const trigger = screen.getByRole('button', { name: label });
      await user.click(trigger);
      const today = screen.getByRole('button', {
        name: /Today, Saturday, November 14th, 2026/,
      });
      await waitFor(() => expect(today).toHaveFocus());
      await user.keyboard('{Enter}');
      await waitFor(() => expect(trigger).toHaveFocus());
    }
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      startDate: '2026-11-14',
      endDate: '2026-11-14',
    });
    await user.click(period);
    await user.click(screen.getByRole('button', { name: 'Clear dates' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(period).toHaveTextContent('All booking dates');
  });

  it('discards a changed Calendar draft on Cancel and Escape', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportPeriod
        allowAllDates
        inputMode="calendar"
        value={null}
        onChange={onChange}
      />,
    );
    const period = screen.getByRole('button', { name: 'Reporting period' });
    await user.click(period);
    await user.click(screen.getByRole('button', { name: 'From (UTC)' }));
    await user.click(screen.getByRole('button', { name: /Today, Saturday/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(period);
    expect(
      screen.getByRole('button', { name: 'From (UTC)' }),
    ).toHaveTextContent('Pick a date');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(period).toHaveFocus());
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    { startDate: '2024-01-01', endDate: '2025-01-01' },
    { startDate: '2026-11-15', endDate: '2026-11-14' },
    { startDate: '', endDate: '2026-11-14' },
  ])(
    'rejects an invalid complete period $startDate to $endDate',
    async (value) => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      // An incomplete draft starts from All dates; complete invalid ranges can
      // also arrive from a controlled consumer and must be checked on Apply.
      render(
        <ReportPeriod
          allowAllDates
          inputMode="calendar"
          value={value.startDate ? value : null}
          onChange={onChange}
        />,
      );
      await user.click(
        screen.getByRole('button', { name: 'Reporting period' }),
      );
      await user.click(screen.getByRole('button', { name: 'Apply dates' }));
      expect(screen.getByText('Invalid reporting period')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'From (UTC)' }),
      ).toHaveAttribute('aria-invalid', 'true');
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('accepts exactly 366 inclusive days and reports no remaining draft', async () => {
    const value = { startDate: '2024-01-01', endDate: '2024-12-31' };
    const onChange = vi.fn();
    const onDraftChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportPeriod
        allowAllDates
        inputMode="calendar"
        value={value}
        onChange={onChange}
        onDraftChange={onDraftChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Reporting period' }));
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(onChange).toHaveBeenCalledWith(value);
    expect(onDraftChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
