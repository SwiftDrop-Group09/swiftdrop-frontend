import type { DeliveryReportResponse } from './contracts';

export function deliveryReportCsv(report: DeliveryReportResponse) {
  const rows = [
    [
      'Date (UTC)',
      'Delivered',
      'Failed',
      'Cancelled',
      'Terminal Total',
      'Success Rate',
      'Failure Rate',
    ],
    ...report.days.map((day) => {
      const terminal = day.delivered + day.failed;
      return [
        day.date,
        day.delivered,
        day.failed,
        day.cancelled,
        terminal,
        `${(terminal ? (day.delivered / terminal) * 100 : 0).toFixed(2)}%`,
        `${(terminal ? (day.failed / terminal) * 100 : 0).toFixed(2)}%`,
      ];
    }),
  ];
  return rows.map((row) => row.join(',')).join('\r\n');
}
