type SaveJob = {
  signature: string;
  save: () => Promise<void>;
  resolve: (current: boolean) => void;
  reject: (error: unknown) => void;
  promise: Promise<boolean>;
};

/** One writer per thread. A newer snapshot supersedes queued work and retries. */
export class LatestThreadSaveQueue {
  private threads = new Map<string, { latest: SaveJob; running: boolean }>();

  constructor(
    private sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {}

  hasPending(thread: string) {
    return this.threads.has(thread);
  }

  enqueue(thread: string, signature: string, save: () => Promise<void>): Promise<boolean> {
    const existing = this.threads.get(thread);
    if (existing?.latest.signature === signature) return existing.latest.promise;
    let resolve!: SaveJob["resolve"];
    let reject!: SaveJob["reject"];
    const promise = new Promise<boolean>((yes, no) => { resolve = yes; reject = no; });
    const job = { signature, save, resolve, reject, promise };
    if (existing) {
      existing.latest.resolve(false);
      existing.latest = job;
    } else {
      this.threads.set(thread, { latest: job, running: false });
    }
    void this.drain(thread);
    return promise;
  }

  private async drain(thread: string) {
    const entry = this.threads.get(thread)!;
    if (entry.running) return;
    entry.running = true;
    while (true) {
      const job = entry.latest;
      for (let attempt = 0; ; attempt++) {
        if (entry.latest !== job) break;
        try {
          await job.save();
          job.resolve(entry.latest === job);
          break;
        } catch (error) {
          if (entry.latest !== job) break;
          const message = error instanceof Error ? error.message : String(error);
          if (/409|thread is busy/i.test(message) && attempt < 3) {
            await this.sleep(1000 * 2 ** attempt);
            continue;
          }
          job.reject(error);
          break;
        }
      }
      if (entry.latest === job) {
        this.threads.delete(thread);
        return;
      }
    }
  }
}
