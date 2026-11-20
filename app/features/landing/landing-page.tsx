import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  Calculator,
  Clock,
  Radio,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react';
import { BrandLogo } from '~/shared/components/brand-logo';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Badge } from '~/shared/components/ui/badge';
import { Separator } from '~/shared/components/ui/separator';
import { useIdentity } from '~/features/identity/session';
import { AssistantWidget } from '~/features/ai-assistant/assistant-widget';

export function LandingPage() {
  const { user, restoring } = useIdentity();
  const navigate = useNavigate();
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleTrackSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = trackingNumber.trim();
    if (!trimmed) return;
    void navigate(`/track?code=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              aria-label="SwiftDrop home"
            >
              <BrandLogo />
            </Link>
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground">
              <Link
                to="/track"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
              >
                Track Parcel
              </Link>
              <Link
                to="/customer/book"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
              >
                Book Delivery
              </Link>
              <a
                href="#features"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
              >
                Features
              </a>
              <a
                href="#roles"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
              >
                Workspaces
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {restoring ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-xs text-muted-foreground">
                  Signed in as{' '}
                  <strong className="font-semibold text-foreground">
                    {user.fullName || user.email}
                  </strong>
                </span>
                <Button asChild size="sm">
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">Create account</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-muted/30 via-background to-background py-16 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-8 items-center">
              {/* Left Column: Headlines & CTA */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-medium text-foreground">
                  <Sparkles className="size-3.5 text-primary animate-pulse" />
                  <span>Smart Urban Logistics & Live Tracking</span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
                  Every parcel delivered on time,{' '}
                  <span className="text-[var(--brand-primary)]">
                    every time.
                  </span>
                </h1>

                <p className="mx-auto lg:mx-0 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                  SwiftDrop connects customers, local merchants, couriers, and
                  dispatchers with instant parcel booking, real-time status
                  updates, and transparent zone pricing.
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                  {user ? (
                    <>
                      <Button size="lg" asChild className="gap-2 shadow-sm">
                        <Link to="/dashboard">
                          Open Your Workspace
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                      <Button size="lg" variant="outline" asChild>
                        <Link to="/customer/book">Book a Parcel</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="lg" asChild className="gap-2 shadow-sm">
                        <Link to="/register">
                          Get Started Free
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                      <Button size="lg" variant="outline" asChild>
                        <Link to="/login">Sign In to Account</Link>
                      </Button>
                    </>
                  )}
                  <Button size="lg" variant="ghost" asChild>
                    <Link to="/track" className="gap-1.5">
                      <Radio className="size-4 text-emerald-500 animate-pulse" />
                      Public Tracking
                    </Link>
                  </Button>
                </div>

                {/* Trust stats / points */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 max-w-lg mx-auto lg:mx-0">
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      Real-time
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Live status tracking
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      Zone-based
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Predictable pricing
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      24/7 AI
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Automated assistance
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Quick Tracking Card */}
              <div className="lg:col-span-5">
                <Card className="border-border/80 shadow-xl bg-card">
                  <CardHeader className="space-y-1.5 pb-4">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="gap-1.5 text-xs font-medium"
                      >
                        <Radio className="size-3 text-emerald-500 animate-pulse" />
                        Live Tracking Tool
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        No login needed
                      </span>
                    </div>
                    <CardTitle
                      role="heading"
                      aria-level={2}
                      className="text-xl font-bold"
                    >
                      Track Your Delivery
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Check parcel progress, milestones, and delivery estimates
                      in real time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleTrackSubmit} className="space-y-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder="e.g. TRK-ABC123-XY"
                          className="pl-9 h-11 text-sm font-mono placeholder:font-sans"
                          aria-label="Parcel tracking number"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-10 gap-2 font-medium"
                        disabled={!trackingNumber.trim()}
                      >
                        <Search className="size-4" />
                        Track Parcel
                      </Button>
                    </form>

                    <Separator />

                    <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1 text-muted-foreground">
                      <p className="font-medium text-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        Need the full tracking dashboard?
                      </p>
                      <p>
                        Visit the dedicated tracking portal to view step-by-step
                        progress, proof of delivery, and real-time refresh.
                      </p>
                      <div className="pt-1.5">
                        <Link
                          to="/track"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                        >
                          Open Dedicated Tracking Page
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Section */}
        <section
          id="features"
          className="py-16 sm:py-24 bg-muted/20 border-b border-border/40"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <Badge
                variant="outline"
                className="text-xs uppercase tracking-wider font-semibold"
              >
                Platform Capabilities
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                Engineered for speed, clarity, and reliability
              </h2>
              <p className="text-base text-muted-foreground">
                Everything you need for seamless parcel dispatch and management,
                designed for modern enterprise workflows.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/70 hover:border-primary/50 transition-colors">
                <CardHeader className="space-y-2">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Radio className="size-5 text-[var(--brand-primary)]" />
                  </div>
                  <CardTitle className="text-lg">Real-Time Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Watch parcels move from pickup to doorstep with live status
                    updates, interactive milestone timelines, and public access.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 hover:border-primary/50 transition-colors">
                <CardHeader className="space-y-2">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Calculator className="size-5 text-[var(--brand-primary)]" />
                  </div>
                  <CardTitle className="text-lg">Predictable Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Automated zone tariffs and weight tiers ensure completely
                    transparent quotes with instant receipt downloads.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 hover:border-primary/50 transition-colors">
                <CardHeader className="space-y-2">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Truck className="size-5 text-[var(--brand-primary)]" />
                  </div>
                  <CardTitle className="text-lg">Smart Dispatch</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Intelligent workload balancing and route optimization ensure
                    couriers receive balanced manifests and verified delivery
                    actions.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 hover:border-primary/50 transition-colors">
                <CardHeader className="space-y-2">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="size-5 text-[var(--brand-primary)]" />
                  </div>
                  <CardTitle className="text-lg">AI Assistant</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    24/7 intelligent conversational assistant ready to answer
                    delivery inquiries, provide shipping quotes, and clarify
                    policies.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Roles and Workspaces Section */}
        <section id="roles" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <Badge
                variant="outline"
                className="text-xs uppercase tracking-wider font-semibold"
              >
                Unified Ecosystem
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                Tailored workspaces for every logistics role
              </h2>
              <p className="text-base text-muted-foreground">
                Whether you are sending a parcel, operating an online store,
                delivering packages, or managing a fleet.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Customer */}
              <div className="rounded-xl border border-border p-6 bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center text-foreground font-semibold">
                    C
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Customer
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Senders & Recipients
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Book on-demand deliveries, generate receipts, inspect active
                  shipments, and view complete history.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full text-xs"
                  >
                    <Link to="/customer/book">Book a Parcel</Link>
                  </Button>
                </div>
              </div>

              {/* Merchant */}
              <div className="rounded-xl border border-border p-6 bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center text-foreground font-semibold">
                    M
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Merchant
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      E-commerce & Stores
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bulk order management, automated webhook integration, and
                  commercial shipping rates.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full text-xs"
                  >
                    <Link to="/merchant">Merchant Portal</Link>
                  </Button>
                </div>
              </div>

              {/* Dispatcher */}
              <div className="rounded-xl border border-border p-6 bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center text-foreground font-semibold">
                    D
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Dispatcher
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Operations & Fleet
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Zone workload matrix, queue monitoring, parcel assignments,
                  and courier capacity planning.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full text-xs"
                  >
                    <Link to="/dispatch/workload">Dispatch Hub</Link>
                  </Button>
                </div>
              </div>

              {/* Courier */}
              <div className="rounded-xl border border-border p-6 bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center text-foreground font-semibold">
                    K
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Courier
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Delivery Drivers
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Mobile delivery manifest, route notes, digital customer
                  signatures, and proof capture.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full text-xs"
                  >
                    <Link to="/courier">Courier Manifest</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="border-t border-border/40 bg-muted/40 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Ready to send or track your next delivery?
            </h2>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground">
              Create an account in seconds or track your parcel directly without
              signing in.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              {user ? (
                <Button size="lg" asChild className="gap-2">
                  <Link to="/dashboard">
                    Go to Your Dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild className="gap-2">
                    <Link to="/register">
                      Create Your Account
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                </>
              )}
              <Button size="lg" variant="secondary" asChild>
                <Link to="/track">Track a Parcel Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <span className="text-xs text-muted-foreground">
                · Every parcel starts here.
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link
                to="/track"
                className="hover:text-foreground transition-colors"
              >
                Track Parcel
              </Link>
              <Link
                to="/login"
                className="hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="hover:text-foreground transition-colors"
              >
                Create Account
              </Link>
              <Link
                to="/customer/book"
                className="hover:text-foreground transition-colors"
              >
                Book Delivery
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating AI Delivery Assistant */}
      <AssistantWidget />
    </div>
  );
}
