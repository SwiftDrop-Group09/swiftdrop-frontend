import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  HelpCircle,
  Info,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { BrandLogo } from '~/shared/components/brand-logo';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Separator } from '~/shared/components/ui/separator';
import { Skeleton } from '~/shared/components/ui/skeleton';
import { DeliveryStepper, StatusBadge, formatDateTime } from './components';
import { usePublicTracking } from './hooks';
import { AssistantWidget } from '~/features/ai-assistant/assistant-widget';

const RECENT_TRACKING_KEY = 'swiftdrop_recent_tracking';

function loadRecentCodes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_TRACKING_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentCode(code: string) {
  if (typeof window === 'undefined' || !code.trim()) return;
  try {
    const existing = loadRecentCodes().filter(
      (c) => c.toLowerCase() !== code.toLowerCase(),
    );
    const updated = [code, ...existing].slice(0, 4);
    localStorage.setItem(RECENT_TRACKING_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

export function PublicTrackingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCode = searchParams.get('code') ?? '';
  const [inputCode, setInputCode] = useState(activeCode);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  useEffect(() => {
    setRecentCodes(loadRecentCodes());
  }, []);

  useEffect(() => {
    setInputCode(activeCode);
  }, [activeCode]);

  const { data, isLoading, isError, refetch, isFetching } = usePublicTracking(
    activeCode || null,
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = inputCode.trim();
    if (!trimmed) return;
    saveRecentCode(trimmed);
    setRecentCodes(loadRecentCodes());
    setSearchParams({ code: trimmed });
  };

  const handleSelectRecent = (code: string) => {
    setInputCode(code);
    saveRecentCode(code);
    setRecentCodes(loadRecentCodes());
    setSearchParams({ code });
  };

  const handleClearRecent = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RECENT_TRACKING_KEY);
      setRecentCodes([]);
    }
  };

  const handleClearInput = () => {
    setInputCode('');
  };

  const handleResetSearch = () => {
    setInputCode('');
    setSearchParams({});
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback if clipboard API is not permitted
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const isTerminal =
    data?.status === 'Delivered' ||
    data?.status === 'Failed' ||
    data?.status === 'Cancelled';

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Top Navigation */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-tight rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="SwiftDrop home"
          >
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="mr-1.5 size-4" />
                Home
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">Customer Portal</Link>
            </Button>
          </div>
        </header>

        {/* Page Context Banner */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs font-medium">
              <Radio className="size-3 text-emerald-500 animate-pulse" />
              Live Tracking Portal
            </Badge>
            <span className="text-xs text-muted-foreground">
              Real-time delivery monitor
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Track Your Parcel
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your SwiftDrop tracking number below to view instant status,
            delivery progress, and milestone updates.
          </p>
        </div>

        {/* Search Input Card */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Enter Tracking Code
            </CardTitle>
            <CardDescription className="text-xs">
              Check delivery status for single packages or merchant orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="e.g. TRK-ABC123-XY"
                  className="pl-9 pr-9 font-mono text-sm placeholder:font-sans"
                  aria-label="Tracking number"
                />
                {inputCode && (
                  <button
                    type="button"
                    onClick={handleClearInput}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm"
                    aria-label="Clear input"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={!inputCode.trim() || isFetching}
                className="gap-1.5"
              >
                {isFetching ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                <span>Track</span>
              </Button>
            </form>

            {/* Quick tips & recent searches */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Info className="size-3.5" />
                Standard format starts with <code>TRK-</code>
              </span>

              {recentCodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Recent:</span>
                  {recentCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleSelectRecent(code)}
                      className="rounded border border-border/70 bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-foreground hover:bg-accent transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="text-[11px] text-muted-foreground hover:underline ml-1"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading Skeleton */}
        {activeCode && isLoading && (
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </Card>
        )}

        {/* Not Found / Error Alert */}
        {activeCode && isError && (
          <Alert variant="destructive" className="space-y-3">
            <AlertTitle className="text-base font-semibold">
              Tracking number not found
            </AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <p>
                We could not locate any parcel matching{' '}
                <strong className="font-mono">{activeCode}</strong>.
              </p>
              <div className="rounded-md bg-destructive/10 p-3 text-xs space-y-1.5 border border-destructive/20">
                <p className="font-semibold">Quick troubleshooting tips:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Verify the code from your confirmation email or SMS.</li>
                  <li>Ensure there are no leading or trailing spaces.</li>
                  <li>
                    Brand new bookings may take 1-2 minutes to register in the
                    tracking system.
                  </li>
                </ul>
              </div>
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSearch}
                  className="h-8 text-xs border-destructive/30 hover:bg-destructive/10"
                >
                  Try another number
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Active Tracking Details */}
        {data && (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-mono text-xl tracking-tight text-foreground">
                      {data.trackingNumber}
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => void handleCopyCode(data.trackingNumber)}
                      title="Copy tracking number"
                      aria-label="Copy tracking number"
                    >
                      {copiedCode ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    {copiedCode && (
                      <span className="text-xs text-emerald-600 font-medium">
                        Copied!
                      </span>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                    <MapPin className="size-3.5 text-primary" />
                    <span>{data.originCity}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{data.destinationCity}</span>
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isTerminal && (
                    <Badge variant="outline" className="gap-1.5 text-xs">
                      <Radio className="size-3 animate-pulse text-emerald-600" />
                      Auto-refreshing (4s)
                    </Badge>
                  )}
                  {isTerminal && (
                    <Badge variant="secondary" className="text-xs">
                      Delivery finalized
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    onClick={() => void refetch()}
                    disabled={isFetching || isTerminal}
                    aria-label="Refresh tracking status"
                  >
                    <RefreshCw
                      className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
                    />
                    Refresh Now
                  </Button>
                  <StatusBadge status={data.status} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Stepper Progress */}
              <DeliveryStepper status={data.status} />

              <Separator />

              {/* Status Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="size-3.5" />
                    Delivery Timeline
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDateTime(data.lastUpdatedAt)}
                  </span>
                </div>

                <ol className="relative border-l border-border pl-4 space-y-4">
                  {data.timeline.map((entry, idx) => (
                    <li
                      key={`${entry.timestamp}-${idx}`}
                      className="space-y-1 relative"
                    >
                      <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {entry.label}
                        </p>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Delivery Completion Notice */}
              {data.status === 'Delivered' && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-semibold">
                      Parcel Successfully Delivered
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400">
                      Thank you for choosing SwiftDrop. Digital proof of
                      delivery has been logged.
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copiedLink ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Share2 className="size-3.5" />
                  )}
                  {copiedLink ? 'Link copied!' : 'Share tracking link'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSearch}
                  className="h-8 text-xs"
                >
                  Track another parcel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* When NO active code is being viewed: Helpful Tracking Guidance (Fixes the "looks alone" issue) */}
        {!activeCode && (
          <div className="space-y-6 pt-2">
            {/* Delivery Journey Stages Guide */}
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Truck className="size-4 text-primary" />
                  How SwiftDrop Delivery Tracking Works
                </CardTitle>
                <CardDescription className="text-xs">
                  Every parcel progresses through standard milestones from
                  dispatch to verified delivery:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">
                        1
                      </span>
                      <span>Booked</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Sender registers shipment; label and tracking ID
                      generated.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">
                        2
                      </span>
                      <span>Assigned</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Dispatcher allocates optimal courier based on zone
                      capacity.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">
                        3
                      </span>
                      <span>In Transit</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Package collected and moving toward the destination
                      locality.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">
                        4
                      </span>
                      <span>Delivered</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Package handed over; recipient signature and proof
                      captured.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking FAQs & Assistance Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/60 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <HelpCircle className="size-4 text-primary" />
                    Where is my tracking number?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p>
                    Your tracking code starts with{' '}
                    <code className="font-mono text-foreground">TRK-</code> and
                    can be found in:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Your parcel booking confirmation email or SMS</li>
                    <li>Merchant order dispatch notifications</li>
                    <li>Your Customer Portal history page</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-600" />
                    Verified Proof of Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p>
                    For your peace of mind, all SwiftDrop couriers obtain
                    verified digital signatures upon doorstep delivery.
                  </p>
                  <p>
                    Account holders can view signature images and download PDF
                    receipts directly in the Customer Portal.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Floating AI Delivery Assistant */}
      <AssistantWidget />
    </div>
  );
}
