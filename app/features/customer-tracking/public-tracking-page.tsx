import { BrandLogo } from '~/shared/components/brand-logo';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Clock, MapPin, Search } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Skeleton } from '~/shared/components/ui/skeleton';
import { DeliveryStepper, StatusBadge, formatDateTime } from './components';
import { usePublicTracking } from './hooks';

export function PublicTrackingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCode = searchParams.get('code') ?? '';
  const [inputCode, setInputCode] = useState(activeCode);

  const { data, isLoading, isError } = usePublicTracking(activeCode || null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = inputCode.trim();
    if (!trimmed) return;
    setSearchParams({ code: trimmed });
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-tight"
          >
            <BrandLogo />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-1.5 size-4" />
              Customer Portal
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Track Your Parcel</CardTitle>
            <CardDescription>
              Enter your SwiftDrop tracking number to view the latest public
              delivery status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Enter tracking number (e.g. TRK-...)"
                  className="pl-9"
                  aria-label="Tracking number"
                />
              </div>
              <Button type="submit">Track</Button>
            </form>
          </CardContent>
        </Card>

        {activeCode && isLoading && <Skeleton className="h-64 w-full" />}

        {activeCode && isError && (
          <Alert variant="destructive">
            <AlertTitle>Tracking number not found</AlertTitle>
            <AlertDescription>
              We could not find a parcel matching "{activeCode}". Please
              double-check the code and try again.
            </AlertDescription>
          </Alert>
        )}

        {data && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-mono text-lg">
                    {data.trackingNumber}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {data.originCity} → {data.destinationCity}
                  </CardDescription>
                </div>
                <StatusBadge status={data.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <DeliveryStepper status={data.status} />

              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="size-3.5" />
                  Timeline (Last updated {formatDateTime(data.lastUpdatedAt)})
                </p>
                <ol className="space-y-2.5 border-l pl-4">
                  {data.timeline.map((entry, idx) => (
                    <li
                      key={`${entry.timestamp}-${idx}`}
                      className="space-y-0.5"
                    >
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.timestamp)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
