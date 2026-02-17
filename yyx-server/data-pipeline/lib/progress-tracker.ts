/**
 * Progress Tracker
 *
 * Tracks completed/failed items and persists state to a JSON file
 * so batch operations can resume after failures.
 */

interface ProgressState {
  completed: string[];
  failed: Array<{ id: string; error: string; timestamp: string }>;
  lastRun: string;
}

export class ProgressTracker {
  private stateFile: string;
  private state: ProgressState;

  constructor(stateFile: string) {
    this.stateFile = stateFile;
    this.state = this.load();
  }

  private load(): ProgressState {
    try {
      const content = Deno.readTextFileSync(this.stateFile);
      return JSON.parse(content);
    } catch {
      return { completed: [], failed: [], lastRun: new Date().toISOString() };
    }
  }

  private save(): void {
    this.state.lastRun = new Date().toISOString();
    Deno.writeTextFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  isCompleted(id: string): boolean {
    return this.state.completed.includes(id);
  }

  markCompleted(id: string): void {
    if (!this.state.completed.includes(id)) {
      this.state.completed.push(id);
      // Remove from failed if it was there
      this.state.failed = this.state.failed.filter((f) => f.id !== id);
      this.save();
    }
  }

  markFailed(id: string, error: string): void {
    this.state.failed = this.state.failed.filter((f) => f.id !== id);
    this.state.failed.push({ id, error, timestamp: new Date().toISOString() });
    this.save();
  }

  reset(): void {
    this.state = { completed: [], failed: [], lastRun: new Date().toISOString() };
    this.save();
  }

  getStats(): { completed: number; failed: number } {
    return {
      completed: this.state.completed.length,
      failed: this.state.failed.length,
    };
  }

  getFailedItems(): Array<{ id: string; error: string }> {
    return this.state.failed;
  }
}
