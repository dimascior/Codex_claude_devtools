/**
 * UpdaterService - Wraps electron-updater's autoUpdater for OTA updates.
 *
 * Forwards update lifecycle events to the renderer via IPC.
 * Auto-download is disabled so users must confirm before downloading.
 */

import { getErrorMessage } from '@shared/utils/errorHandling';
import { createLogger } from '@shared/utils/logger';

import type { UpdaterStatus } from '@shared/types';
import type { BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';

const logger = createLogger('UpdaterService');

export class UpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private readonly autoUpdater: AppUpdater;

  /**
   * The Electron entry (index.ts) passes electron-updater's autoUpdater in; this module only
   * imports its types. electron-updater touches electron.app at import time, and the services
   * barrel loads this module in the standalone server too, where Electron is absent. Importing
   * it in the Electron entry keeps it bundled into the main process output, which ships without
   * node_modules.
   */
  constructor(autoUpdater: AppUpdater) {
    this.autoUpdater = autoUpdater;
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = true;

    this.bindEvents();
  }

  /**
   * Set the main window reference for sending status events.
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Check for available updates.
   */
  async checkForUpdates(): Promise<void> {
    try {
      await this.autoUpdater.checkForUpdates();
    } catch (error) {
      logger.error('Check for updates failed:', getErrorMessage(error));
    }
  }

  /**
   * Download the available update.
   */
  async downloadUpdate(): Promise<void> {
    try {
      await this.autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Download update failed:', getErrorMessage(error));
    }
  }

  /**
   * Quit the app and install the downloaded update.
   * On Windows (NSIS): isSilent=true runs the installer with /S (no wizard);
   * isForceRunAfter=true launches the app after install. Other platforms ignore these.
   */
  quitAndInstall(): void {
    this.autoUpdater.quitAndInstall(true, true);
  }

  private sendStatus(status: UpdaterStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', status);
    }
  }

  private bindEvents(): void {
    this.autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for update...');
      this.sendStatus({ type: 'checking' });
    });

    this.autoUpdater.on('update-available', (info) => {
      logger.info('Update available:', info.version);
      this.sendStatus({
        type: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      });
    });

    this.autoUpdater.on('update-not-available', () => {
      logger.info('No update available');
      this.sendStatus({ type: 'not-available' });
    });

    this.autoUpdater.on('download-progress', (progress) => {
      this.sendStatus({
        type: 'downloading',
        progress: {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
        },
      });
    });

    this.autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded:', info.version);
      this.sendStatus({
        type: 'downloaded',
        version: info.version,
      });
    });

    this.autoUpdater.on('error', (error) => {
      logger.error('Updater error:', getErrorMessage(error));
      this.sendStatus({
        type: 'error',
        error: getErrorMessage(error),
      });
    });
  }
}
