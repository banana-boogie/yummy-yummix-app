/**
 * Progress Tracker
 *
 * Tracks completed/failed items and persists state to a JSON file
 * so batch operations can resume after failures.
 */

/** JSON-serializable shape (completed stored as array on disk) */
interface ProgressStateJSON {
  completed: string[];
  failed: Array<{ id: string; error: string; timestamp: string }>;
  lastRun: string;
}

/** In-memory shape (completed stored as Set for O(1) lookups) */
interface ProgressState {
  completed: Set<string>;
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
      const json: ProgressStateJSON = JSON.parse(content);
      return {
        completed: new Set(json.completed || []),
        failed: json.failed || [],
        lastRun: json.lastRun || new Date().toISOString(),
      };
    } catch {
      return { completed: new Set(), failed: [], lastRun: new Date().toISOString() };
    }
  }

  private save(): void {
    this.state.lastRun = new Date().toISOString();
    // Convert Set to array for JSON serialization
    const json: ProgressStateJSON = {
      completed: [...this.state.completed],
      failed: this.state.failed,
      lastRun: this.state.lastRun,
    };
    Deno.writeTextFileSync(this.stateFile, JSON.stringify(json, null, 2));
  }

  isCompleted(id: string): boolean {
    return this.state.completed.has(id);
  }

  markCompleted(id: string): void {
    if (!this.state.completed.has(id)) {
      this.state.completed.add(id);
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
    this.state = { completed: new Set(), failed: [], lastRun: new Date().toISOString() };
    this.save();
  }

  getStats(): { completed: number; failed: number } {
    return {
      completed: this.state.completed.size,
      failed: this.state.failed.length,
    };
  }

  getFailedItems(): Array<{ id: string; error: string }> {
    return this.state.failed;
  }
}
