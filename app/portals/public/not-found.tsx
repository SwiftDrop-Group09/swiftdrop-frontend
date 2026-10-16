import { data } from 'react-router';

// Technical fallback only; product routes and screens have not been implemented.
export function clientLoader() {
  return data(null, { status: 404 });
}

export default function NotFound() {
  return <p role="alert">Page not found.</p>;
}
