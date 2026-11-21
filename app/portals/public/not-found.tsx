import { data, Link } from 'react-router';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';

// Preserve the SPA route fallback with an explicit client-side 404 status.
export function clientLoader() {
  return data(null, { status: 404 });
}

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-6">
      <Alert>
        <AlertTitle>Page not found.</AlertTitle>
        <AlertDescription>The requested page is unavailable.</AlertDescription>
      </Alert>
      <Button asChild>
        <Link to="/">Return to SwiftDrop</Link>
      </Button>
    </main>
  );
}
