import { CourierApi, CourierError, type Attempt, type Summary } from './api';
export type WorkflowState = Readonly<{
  pending: Attempt | null;
  busy: boolean;
  notice: string;
  blocked: boolean;
  retryAt: number;
  receipt: Summary | null;
}>;
/** An uncertain write keeps the exact original payload, files, version and key. */
export class CourierWorkflow {
  private state: WorkflowState = {
    pending: null,
    busy: false,
    notice: '',
    blocked: false,
    retryAt: 0,
    receipt: null,
  };
  private listeners = new Set<() => void>();
  private disposed = false;
  private lifecycle = 0;
  constructor(private api: CourierApi) {}
  connect() {
    const generation = ++this.lifecycle;
    return () =>
      queueMicrotask(() => {
        // A development effect probe reconnects before this microtask.
        if (this.lifecycle === generation) this.dispose();
      });
  }
  denyRead() {
    this.update({
      pending: null,
      busy: false,
      blocked: true,
      receipt: null,
      notice: 'Access to delivery information has ended.',
    });
  }
  getSnapshot = () => this.state;
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  private update(p: Partial<WorkflowState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((f) => f());
  }
  dispose() {
    this.disposed = true;
    this.state = {
      pending: null,
      busy: false,
      notice: '',
      blocked: true,
      retryAt: 0,
      receipt: null,
    };
    this.listeners.clear();
  }
  async submit(
    attempt?: Attempt,
  ): Promise<'success' | 'reload' | 'denied' | 'pending' | 'ignored'> {
    if (
      this.disposed ||
      this.state.busy ||
      this.state.blocked ||
      Date.now() < this.state.retryAt
    )
      return 'ignored';
    if (this.state.pending && attempt) return 'ignored';
    const original = this.state.pending ?? attempt;
    if (!original) return 'ignored';
    this.update({
      pending: original,
      busy: true,
      notice: 'Waiting for backend confirmation…',
      receipt: null,
    });
    try {
      const receipt = await this.api.submit(original);
      if (this.disposed) return 'ignored';
      this.update({
        pending: null,
        busy: false,
        receipt,
        notice: `${receipt.status} confirmed by Delivery.`,
      });
      return 'success';
    } catch (e) {
      if (this.disposed) return 'ignored';
      const err = e instanceof CourierError ? e : new CourierError('network');
      if (err.uncertain) {
        this.update({
          busy: false,
          notice: err.message,
          pending: original,
          retryAt: Date.now() + err.retryAfter * 1000,
        });
        return 'pending';
      }
      const denied = [401, 403, 404].includes(err.status);
      this.update({
        pending: null,
        busy: false,
        notice: err.message,
        blocked: denied,
      });
      return denied ? 'denied' : 'reload';
    }
  }
}
