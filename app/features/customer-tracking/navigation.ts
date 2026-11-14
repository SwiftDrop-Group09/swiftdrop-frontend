// Only allow known Customer origins. Never follow arbitrary return URLs.
export function deliveryReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/'))
    return '/customer/history';
  try {
    const url = new URL(value, 'https://swiftdrop.invalid');
    if (
      url.origin !== 'https://swiftdrop.invalid' ||
      !['/dashboard', '/customer/history', '/customer/tracking'].includes(
        url.pathname,
      )
    )
      return '/customer/history';
    return url.pathname + url.search;
  } catch {
    return '/customer/history';
  }
}

export function detailHref(id: string, tab = 'overview') {
  return `/customer/parcels/${encodeURIComponent(id)}${tab === 'overview' ? '' : `?tab=${tab}`}`;
}

export function isTerminal(status: string) {
  return ['Delivered', 'Failed', 'Cancelled'].includes(status);
}
