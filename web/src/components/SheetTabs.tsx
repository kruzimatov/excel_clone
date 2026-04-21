import { useEffect, useRef, useState } from 'react';

import type { Sheet } from '../types';
import { classNames } from '../utils/classNames';
import { getDynamicClassName } from '../utils/dynamicStyles';

import styles from './SheetTabs.module.css';

interface SheetTabsProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSwitchSheet: (id: string) => void;
  onAddSheet: (name: string) => void;
  onRenameSheet: (id: string, name: string) => void;
  onDeleteSheet: (id: string) => void;
}

export function SheetTabs({
  sheets,
  activeSheetId,
  onSwitchSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
}: SheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingSheet, setAddingSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [menu, setMenu] = useState<{ sheet: Sheet; x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
    }
  }, []);

  useEffect(() => {
    if (addingSheet && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [addingSheet]);

  function openSheetMenu(sheet: Sheet, x: number, y: number) {
    const menuWidth = 180;
    const menuHeight = 110;
    const left = Math.min(x, window.innerWidth - menuWidth - 12);
    const top = Math.min(y, window.innerHeight - menuHeight - 12);
    setMenu({ sheet, x: Math.max(12, left), y: Math.max(12, top) });
  }

  function beginRename(sheet: Sheet) {
    setEditingId(sheet.id);
    setEditName(sheet.name);
    setMenu(null);
  }

  function submitRename(id: string) {
    if (editName.trim()) {
      onRenameSheet(id, editName.trim());
    }
    setEditingId(null);
  }

  function handleAddSheet() {
    setNewSheetName(`Sheet ${sheets.length + 1}`);
    setAddingSheet(true);
  }

  function submitAdd() {
    const name = newSheetName.trim();
    if (name) {
      onAddSheet(name);
    }
    setAddingSheet(false);
    setNewSheetName('');
  }

  function cancelAdd() {
    setAddingSheet(false);
    setNewSheetName('');
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.content}>
          {sheets.map((sheet) => {
            const isActive = sheet.id === activeSheetId;

            if (editingId === sheet.id) {
              return (
                <div key={sheet.id} className={classNames(styles.tab, styles.tabActive)}>
                  <input
                    className={styles.tabInput}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onBlur={() => submitRename(sheet.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitRename(sheet.id);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                  />
                </div>
              );
            }

            return (
              <button
                key={sheet.id}
                type="button"
                className={classNames(styles.tab, isActive && styles.tabActive)}
                onClick={() => onSwitchSheet(sheet.id)}
                onDoubleClick={() => beginRename(sheet)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openSheetMenu(sheet, event.clientX, event.clientY);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== 'touch') return;
                  if (longPressTimer.current !== null) {
                    window.clearTimeout(longPressTimer.current);
                  }
                  longPressTimer.current = window.setTimeout(() => {
                    openSheetMenu(sheet, event.clientX, event.clientY);
                    longPressTimer.current = null;
                  }, 420);
                }}
                onPointerUp={() => {
                  if (longPressTimer.current !== null) {
                    window.clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onPointerCancel={() => {
                  if (longPressTimer.current !== null) {
                    window.clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
              >
                <span className={classNames(styles.tabText, isActive && styles.tabTextActive)}>
                  {sheet.name}
                </span>
              </button>
            );
          })}

          {addingSheet ? (
            <div className={classNames(styles.tab, styles.tabActive, styles.addingTab)}>
              <input
                ref={addInputRef}
                className={styles.tabInput}
                value={newSheetName}
                onChange={(event) => setNewSheetName(event.target.value)}
                onBlur={submitAdd}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitAdd();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelAdd();
                  }
                }}
                placeholder="Sheet name"
              />
            </div>
          ) : (
            <button type="button" className={styles.addButton} onClick={handleAddSheet}>
              +
            </button>
          )}
        </div>
      </div>

      {menu ? (
        <div className={styles.overlay} onClick={() => setMenu(null)} onContextMenu={(event) => event.preventDefault()}>
          <div
            className={classNames(
              styles.menu,
              getDynamicClassName('sheet-menu', {
                left: `${menu.x}px`,
                top: `${menu.y}px`,
              }),
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.menuItem} onClick={() => beginRename(menu.sheet)}>
              Rename
            </button>
            <button
              type="button"
              className={classNames(styles.menuItem, styles.menuItemDanger)}
              onClick={() => {
                if (sheets.length <= 1) {
                  window.alert('Cannot delete the last sheet');
                } else if (window.confirm(`Delete "${menu.sheet.name}"?`)) {
                  onDeleteSheet(menu.sheet.id);
                }
                setMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
