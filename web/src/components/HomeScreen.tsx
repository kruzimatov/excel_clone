import { useMemo, useState } from 'react';

import type { RecentFileEntry } from '../types';
import { classNames } from '../utils/classNames';

import styles from './HomeScreen.module.css';

type SourceFilter = 'all' | 'device' | 'appscript';

interface DraftSummary {
  title: string;
  savedAt: string;
  currentFileName: string | null;
}

interface AppScriptSummary {
  configured: boolean;
  loading: boolean;
  error: string | null;
  sheetNames: string[];
}

interface HomeScreenProps {
  draft: DraftSummary | null;
  recentFiles: RecentFileEntry[];
  appScript: AppScriptSummary;
  onResumeDraft: () => void;
  onCreateBlank: () => void;
  onOpenFromDevice: () => void;
  onLoadFromAppScript: () => void;
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
  if (source === 'appscript') return 'Apps Script';
  if (source === 'device') return 'Device';
  return 'All';
}

function reopenHint(entry: RecentFileEntry) {
  if (entry.source === 'appscript') return 'Tap to reload from Apps Script';
  if (entry.fileHandleId) return 'Tap to reopen';
  return 'Tap to re-select local file';
}

export function HomeScreen({
  draft,
  recentFiles,
  appScript,
  onResumeDraft,
  onCreateBlank,
  onOpenFromDevice,
  onLoadFromAppScript,
  onOpenRecentFile,
}: HomeScreenProps) {
  const [filter, setFilter] = useState<SourceFilter>('all');

  const filteredRecentFiles = useMemo(() => (
    recentFiles
      .filter((entry) => entry.source !== 'google-drive')
      .filter((entry) => (filter === 'all' ? true : entry.source === filter))
  ), [filter, recentFiles]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark}>X</div>
          <div>
            <p className={styles.kicker}>Excel Clone Workspace</p>
            <h1 className={styles.title}>Spreadsheet storage with Apps Script.</h1>
            <p className={styles.subtitle}>
              Open local files when needed, but use published spreadsheet data from Apps Script as the main storage source.
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
            title="Load from Apps Script"
            detail={appScript.configured ? 'Fetch workbook data from your Apps Script web app.' : 'Add Apps Script config to enable spreadsheet storage.'}
            actionLabel={!appScript.configured ? 'Add script URL first' : appScript.loading ? 'Loading...' : 'Load storage'}
            onPress={onLoadFromAppScript}
            accent="gold"
            disabled={!appScript.configured || appScript.loading}
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
              {(['all', 'device', 'appscript'] as const).map((item) => (
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
                <span>Open something from your device or load your Apps Script workbook to build your recent list.</span>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <div className={styles.driveCard}>
            <div className={styles.sectionHeaderCompact}>
              <div>
                <p className={styles.sectionEyebrow}>Apps Script</p>
                <h2 className={styles.sectionTitle}>Spreadsheet storage</h2>
              </div>
              <span className={classNames(styles.driveStatus, appScript.configured && styles.driveStatusActive)}>
                {appScript.configured ? 'Configured' : 'Needs config'}
              </span>
            </div>

            <p className={styles.driveCopy}>
              This app can load workbook data from a published Apps Script web app and show each remote sheet as a normal tab in the editor.
            </p>

            {!appScript.configured ? (
              <div className={styles.warningBox}>
                Add <code>VITE_APPS_SCRIPT_URL</code> in the web app environment to enable Apps Script loading.
              </div>
            ) : null}

            {appScript.error ? (
              <div className={styles.warningBox}>{appScript.error}</div>
            ) : null}

            <div className={styles.driveActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onLoadFromAppScript}
                disabled={!appScript.configured || appScript.loading}
                title={!appScript.configured ? 'Add VITE_APPS_SCRIPT_URL in web/.env.local first.' : undefined}
              >
                {!appScript.configured ? 'Add Script URL first' : appScript.loading ? 'Loading...' : 'Load workbook'}
              </button>
            </div>

            <div className={styles.driveList}>
              {appScript.sheetNames.length > 0 ? appScript.sheetNames.map((sheetName) => (
                <div key={sheetName} className={styles.driveFileRow}>
                  <div className={styles.fileInfo}>
                    <strong>{sheetName}</strong>
                    <span>Remote sheet tab</span>
                  </div>
                  <span className={styles.linkHint}>Tab</span>
                </div>
              )) : (
                <div className={styles.emptyState}>
                  <strong>{appScript.configured ? 'Remote sheets will appear here.' : 'Add your Apps Script endpoint first.'}</strong>
                  <span>{appScript.configured ? 'Load the workbook to preview the sheet tabs before opening it.' : 'The client reads from one published Apps Script web app URL.'}</span>
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
