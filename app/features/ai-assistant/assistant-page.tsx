import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  Clock,
  CornerDownLeft,
  Loader2,
  MapPin,
  Package,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import { Card, CardContent } from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { WorkspacePage } from '~/shared/components/workspace-page';
import { CustomerSectionHeader } from '~/features/customer-tracking/customer-presentation';
import {
  ParcelListResultCard,
  QuoteResultCard,
  TrackingResultCard,
  ZonesResultCard,
} from './assistant-cards';
import { FormattedAssistantText } from './formatted-assistant-text';
import { useAssistantChat } from './hooks';

const STARTER_PROMPTS = [
  {
    title: 'Where is my parcel?',
    description: 'Check status and milestone timeline for your shipments',
    prompt: 'Where is my parcel?',
    icon: Package,
  },
  {
    title: 'Estimate delivery fee',
    description: 'Calculate instant rates across Sri Lankan zones',
    prompt: 'How much to send 2 kg from Colombo to Kandy?',
    icon: Calculator,
  },
  {
    title: 'Service zones & coverage',
    description: 'See all supported cities and active delivery areas',
    prompt: 'What delivery zones do you cover?',
    icon: MapPin,
  },
  {
    title: 'My recent deliveries',
    description: 'View recent shipments in your customer account',
    prompt: 'List my recent deliveries',
    icon: Clock,
  },
];

export function AssistantPage() {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isSending, sendMessage, clearChat, isAuthenticated } =
    useAssistantChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue('');
    void sendMessage(text);
  };

  const handlePromptClick = (prompt: string) => {
    if (isSending) return;
    void sendMessage(prompt);
  };

  return (
    <WorkspacePage
      title="AI Delivery Assistant"
      description="Ask questions about your active deliveries, track parcels, or get an instant shipping rate estimate across Sri Lanka."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearChat}
          className="text-xs gap-1.5"
        >
          <RotateCcw className="size-3.5 text-muted-foreground" />
          <span>Clear chat</span>
        </Button>
      }
    >
      <Card className="flex flex-col rounded-xl border bg-card shadow-xs h-[calc(100dvh-13.5rem)] min-h-[420px] overflow-hidden">
        {/* Section Header Matching Customer Dashboard Cards */}
        <CustomerSectionHeader
          icon={Sparkles}
          title="Assistant Conversation"
          description="Model Context Protocol (MCP) tool grounded delivery assistant for real-time tracking and quotes."
          action={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {isAuthenticated ? 'Authenticated Customer' : 'Public Guest'}
              </Badge>
            </div>
          }
        />

        {/* Messages Stream */}
        <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pt-0">
          {messages.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center py-6 text-center max-w-2xl mx-auto space-y-6">
              <Badge
                variant="outline"
                className="size-14 justify-center rounded-2xl border-primary/15 bg-primary/5 p-0 text-primary"
                aria-hidden="true"
              >
                <Sparkles className="size-7" />
              </Badge>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  How can I help you today?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Choose a quick topic below or type your question to track
                  parcels, calculate shipping fees, or check coverage.
                </p>
              </div>

              {/* 2x2 Clickable Starter Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left">
                {STARTER_PROMPTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handlePromptClick(item.prompt)}
                      disabled={isSending}
                      className="group flex items-start gap-3.5 rounded-xl border border-border/80 bg-muted/20 p-4 shadow-xs transition-all hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
                    >
                      <Badge
                        variant="outline"
                        className="size-10 shrink-0 justify-center rounded-xl border-primary/15 bg-primary/5 p-0 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        aria-hidden="true"
                      >
                        <Icon className="size-5" />
                      </Badge>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                          <span>{item.title}</span>
                          <ArrowRight className="size-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const hasCards = Boolean(
                msg.cards?.tracking ||
                msg.cards?.quote ||
                msg.cards?.parcelList ||
                msg.cards?.zones,
              );

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-muted/40 text-foreground border border-border/60 rounded-bl-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    ) : (
                      <FormattedAssistantText
                        text={msg.content}
                        hasCards={hasCards}
                      />
                    )}
                  </div>

                  {/* Rich UI Cards */}
                  {msg.cards?.tracking && (
                    <div className="w-full max-w-[95%]">
                      <TrackingResultCard data={msg.cards.tracking} />
                    </div>
                  )}
                  {msg.cards?.quote && (
                    <div className="w-full max-w-[95%]">
                      <QuoteResultCard data={msg.cards.quote} />
                    </div>
                  )}
                  {msg.cards?.parcelList && (
                    <div className="w-full max-w-[95%]">
                      <ParcelListResultCard
                        data={msg.cards.parcelList}
                        onSelectParcel={(code) => {
                          void sendMessage(`Track parcel ${code}`);
                        }}
                      />
                    </div>
                  )}
                  {msg.cards?.zones && (
                    <div className="w-full max-w-[95%]">
                      <ZonesResultCard data={msg.cards.zones} />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* In-Flight State */}
          {isSending && (
            <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium">
                Calling backend MCP tools and retrieving live data...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Bar */}
        <div className="shrink-0 border-t bg-background p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask e.g. 'Where is my parcel?' or 'How much to send 2 kg to Kandy?'..."
              disabled={isSending}
              className="h-10 min-w-0 flex-1 bg-background"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="h-10 gap-1.5"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />
                </>
              )}
            </Button>
          </form>
        </div>
      </Card>
    </WorkspacePage>
  );
}
