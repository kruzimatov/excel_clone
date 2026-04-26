import { useEffect, useMemo, useState } from 'react';

import type { RecentFileEntry } from '../types';
import { classNames } from '../utils/classNames';
import { formatCompactAppDate, t, type AppLanguage } from '../utils/i18n';

import styles from './HomeScreen.module.css';

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
  language: AppLanguage;
  draft: DraftSummary | null;
  recentFiles: RecentFileEntry[];
  loadingFile: boolean;
  storage: StorageSummary;
  onResumeDraft: () => void;
  onCreateBlank: () => void;
  onOpenFromDevice: () => void;
  onOpenRecentFile: (entry: RecentFileEntry) => void;
  onDownloadRecentFile: (entry: RecentFileEntry) => void;
  onRenameRecentFile: (entry: RecentFileEntry) => void;
  onDeleteRecentFile: (entry: RecentFileEntry) => void;
}

export function HomeScreen({
  language,
  draft,
  recentFiles,
  loadingFile,
  storage,
  onResumeDraft,
  onCreateBlank,
  onOpenFromDevice,
  onOpenRecentFile,
  onDownloadRecentFile,
  onRenameRecentFile,
  onDeleteRecentFile,
}: HomeScreenProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const orderedRecentFiles = useMemo(() => (
    recentFiles
      .slice()
      .sort((left, right) => (
        new Date(right.lastOpenedAt ?? right.modifiedAt ?? 0).getTime()
        - new Date(left.lastOpenedAt ?? left.modifiedAt ?? 0).getTime()
      ))
  ), [recentFiles]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(`.${styles.fileActions}`)) {
        setOpenMenuId(null);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{t(language, 'homeKicker')}</p>
          <h1 className={styles.title}>{t(language, 'homeTitle')}</h1>
          <p className={styles.subtitle}>
            {t(language, 'homeSubtitle')}
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={onCreateBlank} disabled={loadingFile}>
            {t(language, 'newSpreadsheet')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onOpenFromDevice} disabled={loadingFile}>
            {t(language, 'openFile')}
          </button>
        </div>
      </header>

      {!storage.healthy ? (
        <div className={styles.notice}>
          {storage.ready ? t(language, 'storageUnavailable') : t(language, 'checkingFiles')}
        </div>
      ) : null}

      <main className={styles.content}>
        {draft ? (
          <section className={styles.resumeCard}>
            <div>
              <p className={styles.sectionEyebrow}>{t(language, 'latestSession')}</p>
              <h2 className={styles.sectionTitle}>{draft.title}</h2>
              <p className={styles.sectionMeta}>
                {formatCompactAppDate(language, draft.savedAt)}
                {draft.currentFileName ? ` • ${draft.currentFileName}` : ''}
              </p>
            </div>
            <button type="button" className={styles.primaryButton} onClick={onResumeDraft}>
              {t(language, 'continue')}
            </button>
          </section>
        ) : null}

        <section className={styles.listCard}>
          <div className={styles.listHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{t(language, 'files')}</p>
              <h2 className={styles.sectionTitle}>{t(language, 'recent')}</h2>
            </div>
          </div>

          {orderedRecentFiles.length > 0 ? orderedRecentFiles.map((entry, index) => (
            <article key={entry.id} className={styles.fileRow}>
              <button
                type="button"
                className={styles.fileMain}
                onClick={() => onOpenRecentFile(entry)}
              >
                <div className={styles.fileInfo}>
                  <strong>{entry.title}</strong>
                </div>
                <div className={styles.fileMeta}>
                  <span>{formatCompactAppDate(language, entry.lastOpenedAt || entry.modifiedAt)}</span>
                </div>
              </button>

              <div className={styles.fileActions}>
                <button
                  type="button"
                  className={styles.menuButton}
                  aria-label={t(language, 'actionsForFile', { title: entry.title })}
                  onClick={() => setOpenMenuId((current) => current === entry.id ? null : entry.id)}
                >
                  •••
                </button>

                {openMenuId === entry.id ? (
                  <div
                    className={classNames(
                      styles.menuCard,
                      index >= orderedRecentFiles.length - 2 && styles.menuCardTop,
                    )}
                  >
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        setOpenMenuId(null);
                        onDownloadRecentFile(entry);
                      }}
                    >
                      {t(language, 'download')}
                    </button>
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        setOpenMenuId(null);
                        onRenameRecentFile(entry);
                      }}
                    >
                      {t(language, 'rename')}
                    </button>
                    <button
                      type="button"
                      className={classNames(styles.menuItem, styles.menuItemDanger)}
                      onClick={() => {
                        setOpenMenuId(null);
                        onDeleteRecentFile(entry);
                      }}
                    >
                      {t(language, 'delete')}
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          )) : (
            <div className={styles.emptyState}>
              <strong>{t(language, 'noFiles')}</strong>
              <span>{t(language, 'noFilesHint')}</span>
            </div>
          )}
        </section>
      </main>

      {loadingFile ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingSpinner} aria-hidden="true" />
            <strong>{t(language, 'loadingFile')}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
