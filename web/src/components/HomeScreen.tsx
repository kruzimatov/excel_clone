import { useMemo, useState } from 'react';

import type { GoogleDriveFile } from '../hooks/useGoogleDrive';
import type { RecentFileEntry } from '../types';
import { classNames } from '../utils/classNames';

import styles from './HomeScreen.module.css';

type SourceFilter = 'all' | 'device' | 'google-drive';

interface DraftSummary {
  title: string;
  savedAt: string;
  currentFileName: string | null;
}

interface HomeScreenProps {
  draft: DraftSummary | null;
  recentFiles: RecentFileEntry[];
  driveConfigured: boolean;
  driveConnected: boolean;
  driveBusy: boolean;
  driveFiles: GoogleDriveFile[];
  driveFolderName: string;
  driveError: string | null;
  onResumeDraft: () => void;
  onCreateBlank: () => void;
  onOpenFromDevice: () => void;
  onConnectDrive: () => void;
  onRefreshDrive: () => void;
  onOpenDriveFile: (fileId: string) => void;
  onOpenRecentFile: (entry: RecentFileEntry) => void;
}

function formatDate(value?: string | null) {
  if (!value) return 'Just now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function sourceLabel(source: SourceFilter | RecentFileEntry['source']) {
  if (source === 'google-drive') return 'Google Drive';
  if (source === 'device') return 'Device';
  return 'All';
}

function reopenHint(entry: RecentFileEntry) {
  if (entry.source === 'google-drive') return 'Tap to reopen from Drive';
  if (entry.fileHandleId) return 'Tap to reopen';
  return 'Tap to re-select local file';
}

export function HomeScreen({
  draft,
  recentFiles,
  driveConfigured,
  driveConnected,
  driveBusy,
  driveFiles,
  driveFolderName,
  driveError,
  onResumeDraft,
  onCreateBlank,
  onOpenFromDevice,
  onConnectDrive,
  onRefreshDrive,
  onOpenDriveFile,
  onOpenRecentFile,
}: HomeScreenProps) {
  const [filter, setFilter] = useState<SourceFilter>('all');

  const filteredRecentFiles = useMemo(() => (
    filter === 'all'
      ? recentFiles
      : recentFiles.filter((entry) => entry.source === filter)
  ), [filter, recentFiles]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark}>X</div>
          <div>
            <p className={styles.kicker}>Excel Clone Workspace</p>
            <h1 className={styles.title}>Sheets home with safer storage.</h1>
            <p className={styles.subtitle}>
              Open from your device, keep a browser draft for safety, and save approved files into one dedicated Google Drive folder.
            </p>
          </div>
        </div>

        <div className={styles.quickActions}>
          <ActionCard
            title="Blank spreadsheet"
            detail="Start a new workbook with 50 visible rows per sheet."
            actionLabel="Create"
            onPress={onCreateBlank}
            accent="green"
          />
          <ActionCard
            title="Open from device"
            detail="Import an `.xlsx` file from this device."
            actionLabel="Open file"
            onPress={onOpenFromDevice}
            accent="blue"
          />
          <ActionCard
            title="Open from Google Drive"
            detail={driveConfigured ? `Use the "${driveFolderName}" folder only.` : 'Add Google Drive config to enable cloud storage.'}
            actionLabel={driveConfigured ? (driveConnected ? 'Refresh Drive' : 'Connect Drive') : 'Add Client ID first'}
            onPress={driveConnected ? onRefreshDrive : onConnectDrive}
            accent="gold"
            disabled={!driveConfigured || driveBusy}
          />
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.mainColumn}>
          {draft ? (
            <div className={styles.resumeCard}>
              <div>
                <p className={styles.sectionEyebrow}>Local draft</p>
                <h2 className={styles.sectionTitle}>{draft.title}</h2>
                <p className={styles.sectionMeta}>
                  Saved {formatDate(draft.savedAt)}
                  {draft.currentFileName ? ` • ${draft.currentFileName}` : ''}
                </p>
              </div>
              <button type="button" className={styles.primaryButton} onClick={onResumeDraft}>
                Resume draft
              </button>
            </div>
          ) : null}

          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Recent files</p>
              <h2 className={styles.sectionTitle}>Continue your work</h2>
            </div>
            <div className={styles.filters}>
              {(['all', 'device', 'google-drive'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={classNames(styles.filterButton, filter === item && styles.filterButtonActive)}
                  onClick={() => setFilter(item)}
                >
                  {sourceLabel(item)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.listCard}>
            {filteredRecentFiles.length > 0 ? filteredRecentFiles.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={styles.fileRow}
                onClick={() => onOpenRecentFile(entry)}
              >
                <div className={styles.fileInfo}>
                  <strong>{entry.title}</strong>
                  <span>{entry.currentFileName || entry.name}</span>
                  <span>{reopenHint(entry)}</span>
                </div>
                <div className={styles.fileMeta}>
                  <span className={styles.sourcePill}>{sourceLabel(entry.source)}</span>
                  <span>{formatDate(entry.lastOpenedAt || entry.modifiedAt)}</span>
                </div>
              </button>
            )) : (
              <div className={styles.emptyState}>
                <strong>No recent files yet.</strong>
                <span>Open something from your device or save a workbook to Google Drive to build your recent list.</span>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <div className={styles.driveCard}>
            <div className={styles.sectionHeaderCompact}>
              <div>
                <p className={styles.sectionEyebrow}>Google Drive</p>
                <h2 className={styles.sectionTitle}>Dedicated folder</h2>
              </div>
              <span className={classNames(styles.driveStatus, driveConnected && styles.driveStatusActive)}>
                {driveConnected ? 'Connected' : driveConfigured ? 'Not connected' : 'Needs config'}
              </span>
            </div>

            <p className={styles.driveCopy}>
              This app only creates, lists, opens, and updates files inside <strong>{driveFolderName}</strong>. It does not delete Drive files.
            </p>

            {!driveConfigured ? (
              <div className={styles.warningBox}>
                Add <code>VITE_GOOGLE_CLIENT_ID</code> in the web app environment to enable Google Drive.
              </div>
            ) : null}

            {driveError ? (
              <div className={styles.warningBox}>{driveError}</div>
            ) : null}

            <div className={styles.driveActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={driveConnected ? onRefreshDrive : onConnectDrive}
                disabled={!driveConfigured || driveBusy}
                title={!driveConfigured ? 'Add VITE_GOOGLE_CLIENT_ID in web/.env.local first.' : undefined}
              >
                {!driveConfigured ? 'Add Client ID first' : driveBusy ? 'Working...' : driveConnected ? 'Refresh files' : 'Connect Drive'}
              </button>
            </div>

            <div className={styles.driveList}>
              {driveConnected && driveFiles.length > 0 ? driveFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={styles.driveFileRow}
                  onClick={() => onOpenDriveFile(file.id)}
                >
                  <div className={styles.fileInfo}>
                    <strong>{file.name}</strong>
                    <span>{formatDate(file.modifiedTime)}</span>
                  </div>
                  <span className={styles.linkHint}>Open</span>
                </button>
              )) : (
                <div className={styles.emptyState}>
                  <strong>{driveConnected ? 'No files in the app folder yet.' : 'Drive files will appear here.'}</strong>
                  <span>{driveConnected ? 'Save a workbook to Google Drive to populate this list.' : 'Connect Drive to browse the dedicated app folder.'}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  detail: string;
  actionLabel: string;
  onPress: () => void;
  accent: 'green' | 'blue' | 'gold';
  disabled?: boolean;
}

function ActionCard({
  title,
  detail,
  actionLabel,
  onPress,
  accent,
  disabled = false,
}: ActionCardProps) {
  return (
    <div className={classNames(styles.actionCard, styles[`actionCard${accent[0].toUpperCase()}${accent.slice(1)}`])}>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <button type="button" className={styles.actionButton} onClick={onPress} disabled={disabled}>
        {actionLabel}
      </button>
    </div>
  );
}
