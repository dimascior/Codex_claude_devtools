/**
 * CodexSessionWatcher - Live change notifications for Codex rollouts.
 *
 * Uses a recursive fs.watch on the sessions directory (100ms per-file
 * debounce, matching the Claude FileWatcher). Because recursive watches can
 * miss events (new date directories, network drives, WSL), a cheap catch-up
 * poll also stats the rollouts in today's and yesterday's date directories.
 */

import { createLogger } from '@shared/utils/logger';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { isRolloutFileName, toSessionId } from './codexPaths';

const logger = createLogger('Codex:SessionWatcher');

export interface CodexWatchEvent {
  type: 'add' | 'change' | 'unlink';
  /** Session id (path relative to the sessions dir); empty when unknown */
  sessionId: string;
}

export interface CodexSessionWatcherOptions {
  debounceMs?: number;
  /** Catch-up poll interval; 0 disables polling */
  pollIntervalMs?: number;
  /** Retry interval while the sessions directory does not exist */
  retryIntervalMs?: number;
}

interface FileState {
  mtimeMs: number;
  size: number;
}

export class CodexSessionWatcher extends EventEmitter {
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly known = new Map<string, FileState>();
  private readonly debounceMs: number;
  private readonly pollIntervalMs: number;
  private readonly retryIntervalMs: number;
  private running = false;

  constructor(
    private readonly sessionsDir: string,
    options: CodexSessionWatcherOptions = {}
  ) {
    super();
    this.debounceMs = options.debounceMs ?? 100;
    this.pollIntervalMs = options.pollIntervalMs ?? 3000;
    this.retryIntervalMs = options.retryIntervalMs ?? 10_000;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.attach();
  }

  stop(): void {
    this.running = false;
    this.watcher?.close();
    this.watcher = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.pollTimer = null;
    this.retryTimer = null;
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  isRunning(): boolean {
    return this.running;
  }

  private attach(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      // Codex has not written any session yet; wait for the directory to appear.
      this.retryTimer ??= setInterval(() => {
        if (fs.existsSync(this.sessionsDir)) {
          if (this.retryTimer) clearInterval(this.retryTimer);
          this.retryTimer = null;
          this.attach();
          this.emit('change', { type: 'add', sessionId: '' } satisfies CodexWatchEvent);
        }
      }, this.retryIntervalMs);
      return;
    }

    try {
      this.watcher = fs.watch(this.sessionsDir, { recursive: true }, (_eventType, filename) => {
        this.onFsEvent(filename);
      });
      this.watcher.on('error', (error) => {
        logger.error('Codex sessions watcher error:', error);
        this.watcher?.close();
        this.watcher = null;
      });
    } catch (error) {
      // Recursive watching is unavailable on some platforms; polling still works.
      logger.error('Failed to watch Codex sessions directory:', error);
    }

    void this.primeKnownFiles();
    if (this.pollIntervalMs > 0) {
      this.pollTimer ??= setInterval(() => void this.poll(), this.pollIntervalMs);
    }
  }

  private onFsEvent(filename: string | Buffer | null): void {
    if (!filename) {
      this.emit('change', { type: 'change', sessionId: '' } satisfies CodexWatchEvent);
      return;
    }
    const relative = filename.toString();
    if (!isRolloutFileName(path.basename(relative))) {
      return;
    }
    this.schedule(path.join(this.sessionsDir, relative));
  }

  private schedule(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.debounceTimers.delete(filePath);
        void this.check(filePath);
      }, this.debounceMs)
    );
  }

  /**
   * Stat a rollout and emit add/change/unlink relative to the last known state.
   */
  private async check(filePath: string): Promise<void> {
    const sessionId = toSessionId(this.sessionsDir, filePath);
    const previous = this.known.get(filePath);
    try {
      const stats = await fs.promises.stat(filePath);
      if (previous?.mtimeMs === stats.mtimeMs && previous.size === stats.size) {
        return;
      }
      this.known.set(filePath, { mtimeMs: stats.mtimeMs, size: stats.size });
      this.emit('change', {
        type: previous ? 'change' : 'add',
        sessionId,
      } satisfies CodexWatchEvent);
    } catch {
      if (previous) {
        this.known.delete(filePath);
        this.emit('change', { type: 'unlink', sessionId } satisfies CodexWatchEvent);
      }
    }
  }

  /**
   * Record current state of recent rollouts so the first poll does not report
   * every existing file as new.
   */
  private async primeKnownFiles(): Promise<void> {
    for (const filePath of await this.recentRolloutPaths()) {
      try {
        const stats = await fs.promises.stat(filePath);
        if (!this.known.has(filePath)) {
          this.known.set(filePath, { mtimeMs: stats.mtimeMs, size: stats.size });
        }
      } catch {
        // ignore
      }
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) {
      return;
    }
    for (const filePath of await this.recentRolloutPaths()) {
      if (!this.debounceTimers.has(filePath)) {
        await this.check(filePath);
      }
    }
  }

  /**
   * Rollouts in today's and yesterday's date directories (local time, as
   * Codex partitions them).
   */
  private async recentRolloutPaths(): Promise<string[]> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dirs = [now, yesterday].map((date) =>
      path.join(
        this.sessionsDir,
        String(date.getFullYear()),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      )
    );
    const files: string[] = [];
    for (const dir of dirs) {
      try {
        for (const name of await fs.promises.readdir(dir)) {
          if (isRolloutFileName(name)) {
            files.push(path.join(dir, name));
          }
        }
      } catch {
        // Directory does not exist (yet).
      }
    }
    return files;
  }
}
