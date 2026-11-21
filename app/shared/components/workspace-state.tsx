import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import { Skeleton } from '~/shared/components/ui/skeleton';

export function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div role="status" className="space-y-3 py-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function WorkspaceNotice({
  title,
  description,
  retry,
  pending = false,
  destructive = false,
}: {
  title: string;
  description: string;
  retry?: () => void;
  pending?: boolean;
  destructive?: boolean;
}) {
  return (
    <Alert variant={destructive ? 'destructive' : 'default'}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        {retry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={retry}
          >
            {pending ? 'Retrying…' : 'Try again'}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
