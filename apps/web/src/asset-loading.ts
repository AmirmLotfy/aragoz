export const STAGE_ASSET_DEADLINE_MS = 8000;

/** One deadline covers the manifest and every asset in a stage, including decoding. */
export class AssetLoadBudget {
  private controller = new AbortController();
  private timer: ReturnType<typeof setTimeout>;
  readonly signal = this.controller.signal;

  constructor(timeoutMs = STAGE_ASSET_DEADLINE_MS) {
    this.timer = setTimeout(() => this.controller.abort(new Error('Stage asset deadline reached.')), timeoutMs);
  }

  wait<T>(pending: Promise<T>, discardLate?: (value: T) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = () => reject(this.signal.reason);
      if (this.signal.aborted) abort();
      else this.signal.addEventListener('abort', abort, { once: true });
      // Always observe the operation: loaders may finish after cancellation or reject later.
      void pending.then(value => {
        this.signal.removeEventListener('abort', abort);
        if (this.signal.aborted) {
          try { discardLate?.(value); } catch { /* Disposal must not create an unhandled rejection. */ }
          return;
        }
        resolve(value);
      }, error => {
        this.signal.removeEventListener('abort', abort);
        reject(error);
      });
    });
  }

  close(): void {
    clearTimeout(this.timer);
    if (!this.signal.aborted) this.controller.abort(new Error('Stage asset loading closed.'));
  }
}
