import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  PackageCheck,
  TriangleAlert,
} from 'lucide-react';
import { Alert } from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import { Card } from '~/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import { FieldSet } from '~/shared/components/ui/field';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/shared/components/ui/select';
import { Textarea } from '~/shared/components/ui/textarea';
import {
  active,
  CourierError,
  nextStage,
  proofAttempt,
  reasons,
  statusAttempt,
  type Attempt,
  type Detail,
} from './api';
import { useCourier } from './context';
import { statusLabel } from './presentation';
import { Pending } from './pending';
import { Signature } from './signature';

const instructions: Record<string, string> = {
  Assigned: 'Collect the parcel from the pickup address, then confirm pickup.',
  PickedUp:
    'Confirm when the parcel starts travelling towards its destination.',
  InTransit:
    'Confirm when you start the final delivery journey to the recipient.',
  OutForDelivery:
    'Hand over the parcel, then record the recipient and proof of delivery.',
};
export function Actions({ d }: { d: Detail }) {
  const { workflow, state } = useCourier();
  const queries = useQueryClient();
  const [dialog, setDialog] = useState<'stage' | 'failure' | 'proof' | null>(
    null,
  );
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [recipient, setRecipient] = useState('');
  const [photo, setPhoto] = useState<File>();
  const [signature, setSignature] = useState<File>();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const locked = !!state.pending || state.busy || refreshing;
  const submit = async (make: () => Attempt) => {
    setError('');
    try {
      const result = await workflow.submit(make());
      if (['success', 'reload', 'denied'].includes(result)) {
        setPhoto(undefined);
        setSignature(undefined);
        setNotes('');
        setRecipient('');
        setDialog(null);
        setRefreshing(true);
        await queries.resetQueries({ queryKey: ['courier'] });
        setRefreshing(false);
      }
    } catch (e) {
      setError(
        e instanceof CourierError ? e.message : 'Check your delivery details.',
      );
    }
  };
  function open(value: typeof dialog) {
    setError('');
    setNotes('');
    setReason('');
    setStep(0);
    setDialog(value);
  }
  const next = nextStage[d.status];
  if (!active(d)) return null;
  return (
    <>
      <Card className="gap-4 border-primary/20 bg-primary/5 p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <PackageCheck
                className="size-5 text-primary"
                aria-hidden="true"
              />
              Next action
            </h2>
            <p className="text-sm text-muted-foreground">
              {instructions[d.status]}
            </p>
          </div>
          <Button
            disabled={locked}
            onClick={() => open(next ? 'stage' : 'proof')}
          >
            {next ? `Mark ${statusLabel(next)}` : 'Complete delivery'}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Unable to complete this delivery?
          </p>
          <Button
            variant="outline"
            disabled={locked}
            onClick={() => open('failure')}
          >
            <TriangleAlert aria-hidden="true" />
            Report failed delivery
          </Button>
        </div>
      </Card>
      <Dialog
        open={
          dialog !== null &&
          !(state.receipt?.id === d.id && state.receipt.version !== d.version)
        }
        onOpenChange={(value) => {
          if (!value && !locked) setDialog(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          onInteractOutside={(e) => {
            if (locked) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (locked) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === 'failure'
                ? 'Report failed delivery'
                : dialog === 'proof'
                  ? 'Complete delivery'
                  : `Mark ${statusLabel(next ?? '')}`}
            </DialogTitle>
            <DialogDescription>
              {d.trackingNumber}
              {dialog === 'failure'
                ? ' — the reason will be visible to the booking customer or merchant.'
                : dialog === 'proof'
                  ? ' — recipient and photo or signature are required.'
                  : ' — confirm the next stage. You can add an optional note.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive" role="alert">
              {error}
            </Alert>
          )}
          {state.pending && <Pending />}
          <FieldSet disabled={locked} className="min-w-0 gap-5">
            {dialog === 'failure' && (
              <Label className="grid gap-2">
                Failure reason
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full" aria-label="Failure reason">
                    <SelectValue placeholder="Choose a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r} value={r}>
                        {statusLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            )}
            {(dialog === 'stage' || dialog === 'failure') && (
              <Label className="grid gap-2">
                {dialog === 'failure'
                  ? 'Private failure note (optional)'
                  : 'Private delivery note (optional)'}
                <Textarea
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    dialog === 'failure'
                      ? 'Optional details for the operations team'
                      : 'What happened at this stage?'
                  }
                />
                <span className="text-xs font-normal text-muted-foreground">
                  {notes.length}/500 · Internal delivery note
                </span>
              </Label>
            )}
            {dialog === 'proof' && (
              <>
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Completion steps"
                >
                  {['Recipient', 'Proof', 'Review'].map((label, i) => (
                    <Badge
                      key={label}
                      variant={step === i ? 'default' : 'secondary'}
                    >
                      {i + 1}. {label}
                    </Badge>
                  ))}
                </div>
                {step === 0 && (
                  <Label className="grid gap-2">
                    Recipient name
                    <Input
                      autoComplete="name"
                      maxLength={120}
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="Name of the person receiving the parcel"
                    />
                  </Label>
                )}
                {step === 1 && (
                  <div className="space-y-4">
                    <Label className="grid gap-2">
                      <span className="flex items-center gap-2">
                        <Camera className="size-4" aria-hidden="true" />
                        Proof photo
                      </span>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (
                            file &&
                            (!['image/jpeg', 'image/png'].includes(file.type) ||
                              !file.size ||
                              file.size > 5 * 1024 * 1024)
                          ) {
                            setError('Choose a JPEG/PNG image up to 5 MiB.');
                            return;
                          }
                          setError('');
                          setPhoto(file);
                        }}
                      />
                      <span className="text-xs font-normal text-muted-foreground">
                        JPEG or PNG, up to 5 MiB. A signature can be used
                        instead.
                      </span>
                    </Label>
                    {photo && (
                      <div className="space-y-2">
                        <ProofPreview file={photo} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPhoto(undefined)}
                        >
                          Remove photo
                        </Button>
                      </div>
                    )}
                    <Signature onChange={setSignature} />
                    {signature && (
                      <p className="flex items-center gap-2 text-sm">
                        <CheckCircle2
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        Signature ready
                      </p>
                    )}
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Recipient</dt>
                        <dd className="font-medium">{recipient}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Proof</dt>
                        <dd>
                          {[photo && 'Photo', signature && 'Signature']
                            .filter(Boolean)
                            .join(' and ')}
                        </dd>
                      </div>
                    </dl>
                    {photo && <ProofPreview file={photo} />}
                    {signature && <ProofPreview file={signature} />}
                    <p className="text-sm text-muted-foreground">
                      Confirm only after the parcel has been handed over. This
                      records the delivery as completed.
                    </p>
                  </div>
                )}
              </>
            )}
          </FieldSet>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                dialog === 'proof' && step > 0
                  ? setStep(step - 1)
                  : setDialog(null)
              }
            >
              {dialog === 'proof' && step > 0 ? 'Back' : 'Cancel'}
            </Button>
            {dialog === 'proof' ? (
              step < 2 ? (
                <Button
                  disabled={
                    locked ||
                    (step === 0 ? !recipient.trim() : !photo && !signature)
                  }
                  onClick={() => setStep(step + 1)}
                >
                  Continue
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  disabled={locked}
                  onClick={() =>
                    void submit(() =>
                      proofAttempt(d, recipient, photo, signature),
                    )
                  }
                >
                  Submit proof and complete delivery
                </Button>
              )
            ) : (
              <Button
                variant={dialog === 'failure' ? 'destructive' : 'default'}
                disabled={locked || (dialog === 'failure' && !reason)}
                onClick={() =>
                  void submit(() =>
                    statusAttempt(
                      d,
                      dialog === 'failure' ? 'Failed' : next!,
                      notes,
                      reasons.find((r) => r === reason),
                    ),
                  )
                }
              >
                {dialog === 'failure'
                  ? 'Confirm failed delivery'
                  : `Confirm ${statusLabel(next ?? '')}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ProofPreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    const url = URL.createObjectURL(file);
    if (element) element.src = url;
    return () => {
      if (element) element.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return (
    <img
      ref={image}
      alt={
        file.name === 'signature.png'
          ? 'Recipient signature preview'
          : 'Delivery photo preview'
      }
      className="max-h-48 w-full rounded-md border bg-white object-contain"
    />
  );
}
