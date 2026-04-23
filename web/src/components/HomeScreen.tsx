import { useMemo, useState } from 'react';

import type { RecentFileEntry } from '../types';
import { classNames } from '../utils/classNames';

import styles from './HomeScreen.module.css';

type SourceFilter = 'all' | 'device' | 'backend';

interface DraftSummary {
  title: string;
  savedAt: string;
  currentFileName: string | null;
}

interface StorageSummary {
  ready: boolean;
  healthy: boolean;
  message: string;
}

interface HomeScreenProps {
  draft: DraftSummary | null;
  recentFiles: RecentFileEntry[];
  storage: StorageSummary;
  onResumeDraft: () => void;
  onCreateBlank: () => void;
  onOpenFromDevice: () => void;
  onRefreshStorage: () => void;
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
  if (source === 'backend') return 'Backend';
  if (source === 'device') return 'Device';
  return 'All';
}

function reopenHint(entry: RecentFileEntry) {
  if (entry.source === 'backend') return 'Tap to open the Postgres snapshot';
  return 'Tap to reopen the imported workbook';
}

export function HomeScreen({
  draft,
  recentFiles,
  storage,
  onResumeDraft,
  onCreateBlank,
  onOpenFromDevice,
  onRefreshStorage,
  onOpenRecentFile,
}: HomeScreenProps) {
  const [filter, setFilter] = useState<SourceFilter>('all');

  const filteredRecentFiles = useMemo(() => (
    recentFiles.filter((entry) => (filter === 'all' ? true : entry.source === filter))
  ), [filter, recentFiles]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark}>X</div>
          <div>
            <p className={styles.kicker}>Excel Clone Workspace</p>
            <h1 className={styles.title}>Spreadsheet storage with Express and Postgres.</h1>
            <p className={styles.subtitle}>
              Import `.xlsx` files when you need them, but keep workbook state in the backend so the editor stays fast and recoverable.
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
            title="Refresh backend"
            detail={storage.healthy ? 'Reload saved workbook sessions from Postgres.' : storage.message}
            actionLabel={storage.ready ? 'Refresh list' : 'Checking backend...'}
            onPress={onRefreshStorage}
            accent="gold"
            disabled={!storage.ready}
          />
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.mainColumn}>
          {draft ? (
            <div className={styles.resumeCard}>
              <div>
                <p className={styles.sectionEyebrow}>Latest session</p>
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
              {(['all', 'device', 'backend'] as const).map((item) => (
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
                  <span className={styles.sourcePill}>{sourceLabel(entry.source as SourceFilter)}</span>
                  <span>{formatDate(entry.lastOpenedAt || entry.modifiedAt)}</span>
                </div>
              </button>
            )) : (
              <div className={styles.emptyState}>
                <strong>No recent files yet.</strong>
                <span>Create a workbook or import an `.xlsx` file to start building your backend session history.</span>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <div className={styles.driveCard}>
            <div className={styles.sectionHeaderCompact}>
              <div>
                <p className={styles.sectionEyebrow}>Backend</p>
                <h2 className={styles.sectionTitle}>Postgres storage</h2>
              </div>
              <span className={classNames(styles.driveStatus, storage.healthy && styles.driveStatusActive)}>
                {storage.ready ? (storage.healthy ? 'Connected' : 'Unavailable') : 'Checking'}
              </span>
            </div>

            <p className={styles.driveCopy}>
              Workbook snapshots and recents now live behind an Express API backed by PostgreSQL so we can scale saves and recovery cleanly.
            </p>

            <div className={styles.warningBox}>{storage.message}</div>

            <div className={styles.driveActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onRefreshStorage}
                disabled={!storage.ready}
              >
                {storage.ready ? 'Refresh sessions' : 'Checking backend...'}
              </button>
            </div>

            <div className={styles.driveList}>
              {recentFiles.length > 0 ? recentFiles.slice(0, 4).map((entry) => (
                <div key={entry.id} className={styles.driveFileRow}>
                  <div className={styles.fileInfo}>
                    <strong>{entry.title}</strong>
                    <span>{entry.currentFileName || entry.name}</span>
                  </div>
                  <span className={styles.linkHint}>{sourceLabel(entry.source)}</span>
                </div>
              )) : (
                <div className={styles.emptyState}>
                  <strong>{storage.healthy ? 'Saved workbooks will appear here.' : 'Backend connection is not ready yet.'}</strong>
                  <span>{storage.healthy ? 'The newest backend sessions show up here for quick access.' : 'Start the backend and refresh the storage panel to enable server-side saving.'}</span>
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
