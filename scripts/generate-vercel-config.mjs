import fs from 'node:fs';

const backendTarget = process.env.BACKEND_API_TARGET;

const rewrites = [];

if (backendTarget) {
  const target = backendTarget.replace(/\/+$/, '');
  rewrites.push(
    { source: '/api/(.*)', destination: `${target}/api/$1` },
    { source: '/graphql/(.*)', destination: `${target}/graphql/$1` },
  );
}

// Fallback to React Router SPA
rewrites.push({ source: '/(.*)', destination: '/index.html' });

const config = {
  rewrites,
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],
};

fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n');
console.log(
  `[Vercel Config] Generated vercel.json with target: ${backendTarget || '(static only)'}`,
);
