const STRIP_REQ = [
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
];

async function handler(request: Request): Promise<Response> {
  const target = process.env.BACKEND_API_TARGET;
  if (!target) {
    return Response.json(
      { error: 'BACKEND_API_TARGET is not configured' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const base = target.replace(/\/+$/, '');

  const headers = new Headers(request.headers);
  STRIP_REQ.forEach((h) => headers.delete(h));
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(`${base}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  out.delete('transfer-encoding');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;

