export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const backendTarget = process.env.BACKEND_API_TARGET;
  if (!backendTarget) {
    return new Response(
      JSON.stringify({
        error: 'BACKEND_API_TARGET is not configured in Vercel',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const url = new URL(request.url);
  const targetBase = backendTarget.replace(/\/+$/, '');
  const targetUrl = `${targetBase}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('host', new URL(targetBase).host);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body:
      request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
    redirect: 'manual',
  });
}
