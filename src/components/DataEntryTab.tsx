import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Upload,
  Trash2,
  Calendar,
  Clock,
  Search,
  AlertTriangle,
  Eye,
  Check,
  Sparkles,
  X
} from 'lucide-react';
import { AppState, Item, Row } from '../types';
import {
  acct,
  addDay,
  computeRows,
  dcmp,
  f2,
  fd,
  getWeekOf,
  num,
  raw,
  rnd,
  today
} from '../utils/helpers';
import { exportDataEntry, parseDataEntryImport } from '../utils/excel';
import { ChangeHistory } from './ChangeHistory';
import * as XLSX from 'xlsx';

interface DataEntryTabProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState, actionDescription?: string) => void;
  canEdit: boolean;
  canAdmin: boolean;
  onAskConfirm: (message: string, onConfirm: () => void) => void;
}

export const DataEntryTab: React.FC<DataEntryTabProps> = ({
  state,
  onUpdateState,
  canEdit,
  canAdmin,
  onAskConfirm
}) => {
  const currentDate = state.vd || state.start || today();
  const currentShift: 'AM' | 'PM' = state.vf === 'PM' ? 'PM' : 'AM';

  const [activeItemSearchIndex, setActiveItemSearchIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(0);
  const [dropdownCoords, setDropdownCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openAbove: boolean;
  } | null>(null);
  const [tableItemSearch, setTableItemSearch] = useState('');
  const [showToolbarSearchPreview, setShowToolbarSearchPreview] = useState(false);
  const [highlightedToolbarIndex, setHighlightedToolbarIndex] = useState(0);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const highlightedItemRef = useRef<HTMLDivElement>(null);
  const toolbarSearchRef = useRef<HTMLDivElement>(null);
  const toolbarInputRef = useRef<HTMLInputElement>(null);

  // Computations
  const computed = computeRows(state.rows, state.items);

  // Filter rows for current location, date, and shift (with optional toolbar search)
  const currentRowsWithIndex = state.rows
    .map((r, i) => ({ r, i, c: computed[i] }))
    .filter(
      item =>
        item.r.loc === state.inv &&
        item.r.date === currentDate &&
        item.r.fr === currentShift
    )
    .filter(item => {
      if (!tableItemSearch.trim()) return true;
      const s = tableItemSearch.toLowerCase().trim();
      const it = state.items.find(x => x.no === item.r.no);
      if (!it) return false;
      return (
        it.desc.toLowerCase().includes(s) ||
        it.code.toLowerCase().includes(s) ||
        it.cat.toLowerCase().includes(s) ||
        String(it.no).includes(s) ||
        String(it.srp).includes(s)
      );
    });

  // Sort rows by Category, then Item Description, then row index
  currentRowsWithIndex.sort((a, b) => {
    const itA = state.items.find(x => x.no === a.r.no);
    const itB = state.items.find(x => x.no === b.r.no);
    const catA = itA?.cat || 'Uncategorized';
    const catB = itB?.cat || 'Uncategorized';
    const catCmp = catA.localeCompare(catB);
    if (catCmp !== 0) return catCmp;
    const descA = itA?.desc || '';
    const descB = itB?.desc || '';
    return descA.localeCompare(descB) || (a.r.no as number) - (b.r.no as number) || a.i - b.i;
  });

  // Group by category
  const categories: { name: string; items: typeof currentRowsWithIndex }[] = [];
  currentRowsWithIndex.forEach(item => {
    const it = state.items.find(x => x.no === item.r.no);
    const catName = it?.cat || 'Uncategorized';
    let group = categories.find(g => g.name === catName);
    if (!group) {
      group = { name: catName, items: [] };
      categories.push(group);
    }
    group.items.push(item);
  });

  // Total sales across all categories for today's shift
  const totalSalesDay = currentRowsWithIndex.reduce((sum, item) => sum + item.c.sales, 0);

  // Cash Details
  const cashKey = `${state.inv}|${currentDate}${currentShift === 'PM' ? '|PM' : ''}`;
  const cashOnHandRaw = state.cash[cashKey];
  const hasCash = cashOnHandRaw !== undefined && cashOnHandRaw !== '';
  const cashOnHandVal = num(cashOnHandRaw);
  const overShortVal = hasCash ? cashOnHandVal - totalSalesDay : 0;
  const currentCashier = state.cinfo[cashKey]?.cashier || '';
  const currentShiftLetter = state.cinfo[cashKey]?.shift || '';

  const updateDropdownCoords = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 320 && rect.top > 320;

    const targetWidth = Math.max(360, Math.min(460, window.innerWidth - 24));
    let targetLeft = rect.left;
    if (targetLeft + targetWidth > window.innerWidth - 12) {
      targetLeft = window.innerWidth - targetWidth - 12;
    }
    if (targetLeft < 12) targetLeft = 12;

    setDropdownCoords({
      top: openAbove ? Math.max(10, rect.top - 6) : rect.bottom + 4,
      left: targetLeft,
      width: targetWidth,
      openAbove
    });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        activeInputRef.current &&
        !activeInputRef.current.contains(target)
      ) {
        setActiveItemSearchIndex(null);
        setDropdownCoords(null);
      }
      if (
        toolbarSearchRef.current &&
        !toolbarSearchRef.current.contains(target) &&
        toolbarInputRef.current &&
        !toolbarInputRef.current.contains(target)
      ) {
        setShowToolbarSearchPreview(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll highlighted item in preview dropdown into view
  useEffect(() => {
    if (highlightedItemRef.current) {
      highlightedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedItemIndex]);

  // Update dropdown coordinates on window or table scroll
  useEffect(() => {
    if (activeItemSearchIndex === null) return;
    const updatePos = () => {
      if (activeInputRef.current) {
        updateDropdownCoords(activeInputRef.current);
      }
    };
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [activeItemSearchIndex]);

  // Match highlighter helper
  const highlightMatch = (text: string, query: string) => {
    if (!query || !query.trim()) return <>{text}</>;
    const cleanQ = query.trim();
    const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, idx) =>
          part.toLowerCase() === cleanQ.toLowerCase() ? (
            <mark
              key={idx}
              className="bg-amber-200 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 font-bold px-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </>
    );
  };

  const handleDateChange = (newDate: string) => {
    onUpdateState(prev => {
      const next = { ...prev, vd: newDate };
      return next;
    });
  };

  const handleShiftChange = (newShift: 'AM' | 'PM') => {
    onUpdateState(prev => {
      const next = { ...prev, vf: newShift };
      return next;
    });
  };

  const handlePrevDay = () => {
    handleDateChange(addDay(currentDate, -1));
  };

  const handleNextDay = () => {
    handleDateChange(addDay(currentDate, 1));
  };

  const handleAddRow = () => {
    onUpdateState(
      prev => ({
        ...prev,
        rows: [
          ...prev.rows,
          {
            no: '',
            date: currentDate,
            loc: prev.inv,
            fr: currentShift,
            beg: '',
            del: '',
            doc: '',
            wd: '',
            tf: '',
            tfl: '',
            itf: '',
            tt: '',
            ttl: '',
            itt: '',
            bad: '',
            end: ''
          }
        ]
      }),
      `Blank row added on ${fd(currentDate)} (${currentShift} Shift)`
    );
  };

  const handleCellChange = (rowIndex: number, field: keyof Row, value: any) => {
    onUpdateState(prev => {
      const newRows = [...prev.rows];
      const target = { ...newRows[rowIndex], [field]: value };
      newRows[rowIndex] = target;
      return { ...prev, rows: newRows };
    });
  };

  const handleNumberInput = (rowIndex: number, field: keyof Row, rawVal: string) => {
    const clean = rawVal.trim() === '' ? '' : parseFloat(rawVal.replace(/,/g, ''));
    const val = isNaN(clean as number) ? '' : clean;
    handleCellChange(rowIndex, field, val);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const row = state.rows[rowIndex];
    const itemObj = state.items.find(x => x.no === row.no);
    const label = itemObj?.desc || '(unspecified item)';

    onUpdateState(prev => {
      const newRows = [...prev.rows];
      const removed = newRows.splice(rowIndex, 1)[0];
      const nextNc = { ...(prev.nc || {}) };
      if (removed && removed.gen && removed.no) {
        nextNc[`${removed.loc}|${removed.date}${removed.fr === 'PM' ? '|PM' : ''}|${removed.no}`] = 1;
      }
      return {
        ...prev,
        rows: newRows,
        nc: nextNc
      };
    }, `${fd(row.date)} ${row.fr} ${label} row deleted`);
  };

  const handleDeleteAllEntries = () => {
    const count = state.rows.filter(r => r.loc === state.inv).length;
    onAskConfirm(
      `Delete all ${count} entries for ${state.inv} (across every date and shift)?\nThis will also reset cash details for this location.`,
      () => {
        onUpdateState(
          prev => {
            const remainingRows = prev.rows.filter(r => r.loc !== prev.inv);
            const nextCash = { ...prev.cash };
            const nextCinfo = { ...prev.cinfo };
            const nextCpay = { ...prev.cpay };
            const nextNc = { ...(prev.nc || {}) };

            Object.keys(nextCash).forEach(k => {
              if (k.startsWith(prev.inv + '|')) delete nextCash[k];
            });
            Object.keys(nextCinfo).forEach(k => {
              if (k.startsWith(prev.inv + '|')) delete nextCinfo[k];
            });
            Object.keys(nextCpay).forEach(k => {
              if (k.startsWith(prev.inv + '|')) delete nextCpay[k];
            });
            Object.keys(nextNc).forEach(k => {
              if (k.startsWith(prev.inv + '|')) delete nextNc[k];
            });

            return {
              ...prev,
              rows: remainingRows,
              cash: nextCash,
              cinfo: nextCinfo,
              cpay: nextCpay,
              nc: nextNc
            };
          },
          `All ${count} entries for ${state.inv} deleted`
        );
      }
    );
  };

  const handleCashChange = (valStr: string) => {
    const clean = valStr.trim() === '' ? '' : parseFloat(valStr.replace(/,/g, ''));
    const val = isNaN(clean as number) ? '' : clean;
    onUpdateState(prev => ({
      ...prev,
      cash: {
        ...prev.cash,
        [cashKey]: val
      }
    }));
  };

  const handleCashierChange = (field: 'cashier' | 'shift', val: string) => {
    onUpdateState(
      prev => ({
        ...prev,
        cinfo: {
          ...prev.cinfo,
          [cashKey]: {
            cashier: field === 'cashier' ? val : prev.cinfo[cashKey]?.cashier || '',
            shift: field === 'shift' ? val : prev.cinfo[cashKey]?.shift || ''
          }
        }
      }),
      `${fd(currentDate)} ${currentShift} Cashier ${field === 'cashier' ? 'Name' : 'Shift'} updated: ${val}`
    );
  };

  // Filter items for row item autocomplete with real-time preview ranking
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return state.items;
    const term = searchTerm.toLowerCase().trim();
    return [...state.items]
      .filter(it => {
        return (
          it.desc.toLowerCase().includes(term) ||
          it.code.toLowerCase().includes(term) ||
          it.cat.toLowerCase().includes(term) ||
          it.sys.toLowerCase().includes(term) ||
          String(it.srp).includes(term) ||
          String(it.no).includes(term)
        );
      })
      .sort((a, b) => {
        const aDesc = a.desc.toLowerCase();
        const bDesc = b.desc.toLowerCase();
        const aStarts = aDesc.startsWith(term);
        const bStarts = bDesc.startsWith(term);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        const aIndex = aDesc.indexOf(term);
        const bIndex = bDesc.indexOf(term);
        if (aIndex !== -1 && bIndex !== -1 && aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        return a.no - b.no;
      });
  }, [state.items, searchTerm]);

  // Filter items for toolbar search preview while typing letters or numbers
  const toolbarFilteredItems = useMemo(() => {
    if (!tableItemSearch.trim()) return [];
    const term = tableItemSearch.toLowerCase().trim();
    return [...state.items]
      .filter(it => {
        return (
          it.desc.toLowerCase().includes(term) ||
          it.code.toLowerCase().includes(term) ||
          it.cat.toLowerCase().includes(term) ||
          it.sys.toLowerCase().includes(term) ||
          String(it.srp).includes(term) ||
          String(it.no).includes(term)
        );
      })
      .sort((a, b) => {
        const aDesc = a.desc.toLowerCase();
        const bDesc = b.desc.toLowerCase();
        const aStarts = aDesc.startsWith(term);
        const bStarts = bDesc.startsWith(term);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.no - b.no;
      });
  }, [state.items, tableItemSearch]);

  const selectItemForCurrentRow = (itemNo: number) => {
    if (activeItemSearchIndex === null) return;
    const targetRow = state.rows[activeItemSearchIndex];
    const prevItem = state.items.find(x => x.no === targetRow.no);
    const nextItem = state.items.find(x => x.no === itemNo);

    handleCellChange(activeItemSearchIndex, 'no', itemNo);
    setActiveItemSearchIndex(null);
    setDropdownCoords(null);
    setSearchTerm('');

    onUpdateState(
      prev => prev,
      `${fd(targetRow.date)} ${targetRow.fr} item changed: "${prevItem?.desc || '(blank)'}" → "${nextItem?.desc || ''}"`
    );
  };

  // File import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const sheetRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const result = parseDataEntryImport(sheetRows, state);
        if (result.error) {
          setMsg(result.error);
          return;
        }

        onUpdateState(
          prev => ({
            ...prev,
            rows: result.newRows,
            cash: { ...prev.cash, ...result.cashUpdates },
            cinfo: { ...prev.cinfo, ...result.cinfoUpdates }
          }),
          `Imported entries: ${result.added} added, ${result.updated} updated${
            result.skipped ? `, ${result.skipped} skipped` : ''
          }`
        );
        setMsg(`Import complete: ${result.added} added, ${result.updated} updated.`);
      } catch {
        setMsg('Could not process this Excel file. Check format.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Left: Date & Shift picker, Prev/Next day */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <input
              type="date"
              value={currentDate}
              onChange={e => handleDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
            <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <select
              value={currentShift}
              onChange={e => handleShiftChange(e.target.value as 'AM' | 'PM')}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="AM" className="dark:bg-slate-900">
                AM Shift
              </option>
              <option value="PM" className="dark:bg-slate-900">
                PM Shift
              </option>
            </select>
          </div>

          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Search Item Description with Real-time Preview while typing */}
        <div className="relative min-w-[220px] sm:min-w-[280px] max-w-sm flex-1">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              ref={toolbarInputRef}
              type="text"
              value={tableItemSearch}
              onChange={e => {
                setTableItemSearch(e.target.value);
                setShowToolbarSearchPreview(true);
                setHighlightedToolbarIndex(0);
              }}
              onFocus={() => setShowToolbarSearchPreview(true)}
              onKeyDown={e => {
                if (!showToolbarSearchPreview || toolbarFilteredItems.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedToolbarIndex(prev => Math.min(prev + 1, toolbarFilteredItems.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedToolbarIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (toolbarFilteredItems[highlightedToolbarIndex]) {
                    setTableItemSearch(toolbarFilteredItems[highlightedToolbarIndex].desc);
                    setShowToolbarSearchPreview(false);
                  }
                } else if (e.key === 'Escape') {
                  setShowToolbarSearchPreview(false);
                }
              }}
              placeholder="Search item description..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            {tableItemSearch && (
              <button
                type="button"
                onClick={() => {
                  setTableItemSearch('');
                  setShowToolbarSearchPreview(false);
                }}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toolbar Search Preview Dropdown while typing letters or numbers */}
          {showToolbarSearchPreview && tableItemSearch.trim() && (
            <div
              ref={toolbarSearchRef}
              className="absolute left-0 top-full mt-1.5 z-40 w-full min-w-[320px] max-w-md max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 shadow-2xl p-2 text-xs divide-y divide-slate-100 dark:divide-slate-800"
            >
              <div className="pb-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Item Preview: "{tableItemSearch}"</span>
                </span>
                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-semibold">
                  {toolbarFilteredItems.length} found
                </span>
              </div>

              <div className="pt-1.5 overflow-y-auto max-h-56 space-y-1">
                {toolbarFilteredItems.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 italic text-xs">
                    No items matching "{tableItemSearch}"
                  </div>
                ) : (
                  toolbarFilteredItems.map((itemChoice, cIdx) => {
                    return (
                      <div
                        key={itemChoice.no}
                        onClick={() => {
                          setTableItemSearch(itemChoice.desc);
                          setShowToolbarSearchPreview(false);
                        }}
                        onMouseEnter={() => setHighlightedToolbarIndex(cIdx)}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                          highlightedToolbarIndex === cIdx
                            ? 'bg-teal-50 dark:bg-teal-900/50 text-teal-950 dark:text-teal-100'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {highlightMatch(itemChoice.desc, tableItemSearch)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold font-mono text-teal-700 dark:text-teal-400 text-xs">
                            ₱{f2(itemChoice.srp)}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">SRP</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add row</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportDataEntry(state)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export (Download)</span>
          </button>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Import (Upload)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          )}

          {canAdmin && (
            <button
              type="button"
              onClick={handleDeleteAllEntries}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete all entries</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Search Filter Banner */}
      {tableItemSearch.trim() && (
        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>
              Showing {currentRowsWithIndex.length} row(s) matching <strong className="font-mono">"{tableItemSearch}"</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setTableItemSearch('');
              setShowToolbarSearchPreview(false);
            }}
            className="text-xs text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-200 underline font-medium cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {msg && (
        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-800 dark:text-teal-300 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-teal-600 hover:text-teal-800 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Main Ledger Table (Expanded Full Width, No Horizontal Scrollbar) */}
      <div className="relative rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="w-full overflow-x-hidden overflow-y-auto max-h-[75vh]">
          <table className="w-full table-fixed border-collapse text-[10px] sm:text-[11px] 2xl:text-xs leading-tight ledger-table font-sans">
            <colgroup>
              {(canAdmin
                ? ['5.8%', '3.6%', '12.8%', '4.6%', '4.5%', '5.2%', '4.5%', '4.4%', '6.2%', '4.5%', '4.4%', '6.2%', '4.5%', '4.0%', '5.2%', '4.6%', '5.0%', '4.6%', '6.8%', '3.4%']
                : ['6.0%', '3.8%', '15.0%', '4.6%', '4.5%', '5.2%', '4.5%', '4.4%', '6.2%', '4.5%', '4.4%', '6.2%', '4.5%', '4.0%', '5.2%', '4.6%', '5.0%', '4.6%', '6.9%']
              ).map((w, idx) => (
                <col key={idx} style={{ width: w }} />
              ))}
            </colgroup>
            <thead className="bg-slate-200/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold sticky top-0 z-20 shadow-xs">
              <tr className="border-b border-slate-300 dark:border-slate-700">
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Date
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Wk
                </th>
                <th className="py-2 px-1 text-left border-r border-slate-300 dark:border-slate-700">
                  Item Description
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Beg Inv
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Deliv
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Doc #
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Stock W/D
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  TF From
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  From Loc
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Int TF (In)
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Transfer To
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  To Loc
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Int TT (Out)
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Bad Order
                </th>
                <th className="py-2 px-0.5 text-center bg-teal-50 dark:bg-teal-950/40 border-r border-slate-300 dark:border-slate-700 font-semibold">
                  Goods Avail
                </th>
                <th className="py-2 px-0.5 text-center border-r border-slate-300 dark:border-slate-700">
                  Ending Inv
                </th>
                <th className="py-2 px-0.5 text-center bg-teal-50 dark:bg-teal-950/40 border-r border-slate-300 dark:border-slate-700 font-semibold">
                  Goods Sold
                </th>
                <th className="py-2 px-0.5 text-right border-r border-slate-300 dark:border-slate-700">
                  SRP
                </th>
                <th className="py-2 px-1 text-right bg-teal-50 dark:bg-teal-950/40 font-semibold border-r border-slate-300 dark:border-slate-700">
                  Total Sales
                </th>
                {canAdmin && <th className="py-2 px-0.5 text-center"></th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentRowsWithIndex.length === 0 ? (
                <tr>
                  <td colSpan={canAdmin ? 20 : 19} className="py-12 text-center text-slate-500 italic">
                    No {currentShift} Shift entries on {fd(currentDate)}. Click "Add row" to record
                    stock movement or import an existing sheet.
                  </td>
                </tr>
              ) : (
                categories.map(cat => {
                  const catTotals = {
                    beg: 0,
                    del: 0,
                    wd: 0,
                    tf: 0,
                    itf: 0,
                    tt: 0,
                    itt: 0,
                    bad: 0,
                    tg: 0,
                    end: 0,
                    sold: 0,
                    sales: 0
                  };

                  cat.items.forEach(it => {
                    catTotals.beg += it.c.beg;
                    catTotals.del += num(it.r.del);
                    catTotals.wd += num(it.r.wd);
                    catTotals.tf += num(it.r.tf);
                    catTotals.itf += num(it.r.itf);
                    catTotals.tt += num(it.r.tt);
                    catTotals.itt += num(it.r.itt);
                    catTotals.bad += num(it.r.bad);
                    catTotals.tg += it.c.tg;
                    catTotals.end += num(it.r.end);
                    catTotals.sold += it.c.sold;
                    catTotals.sales += it.c.sales;
                  });

                  return (
                    <React.Fragment key={cat.name}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-teal-900 dark:text-teal-300">
                        <td
                          colSpan={canAdmin ? 20 : 19}
                          className="py-1 px-3 text-xs tracking-wide uppercase border-y border-slate-200 dark:border-slate-800"
                        >
                          {cat.name}
                        </td>
                      </tr>

                      {/* Rows in this category */}
                      {cat.items.map(({ r, i, c }) => {
                        const itObj = state.items.find(x => x.no === r.no);
                        const isSoldOut = c.tg > 0 && num(r.end) === 0;

                        return (
                          <tr
                            key={i}
                            className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors"
                          >
                            {/* Date */}
                            <td className="py-1 px-0.5 text-center font-mono text-[9.5px] 2xl:text-[10.5px] text-slate-500 border-r border-slate-200 dark:border-slate-800 truncate">
                              {fd(r.date)}
                            </td>

                            {/* Week */}
                            <td className="py-1 px-0.5 text-center font-mono text-[9px] 2xl:text-[10px] text-slate-500 border-r border-slate-200 dark:border-slate-800 truncate">
                              {getWeekOf(r.date, state.start, state.cut)}
                            </td>

                            {/* Item Description (Interactive with Real-time Preview while typing letters or numbers) */}
                            <td className="p-0.5 border-r border-slate-200 dark:border-slate-800 relative">
                              <div className="relative">
                                <input
                                  type="text"
                                  disabled={!canEdit}
                                  value={
                                    activeItemSearchIndex === i
                                      ? searchTerm
                                      : itObj
                                      ? `${itObj.desc} (SRP ${f2(itObj.srp)})`
                                      : ''
                                  }
                                  placeholder="Search item description..."
                                  onFocus={e => {
                                    if (!canEdit) return;
                                    setActiveItemSearchIndex(i);
                                    setSearchTerm(itObj ? itObj.desc : '');
                                    setHighlightedItemIndex(0);
                                    activeInputRef.current = e.currentTarget;
                                    updateDropdownCoords(e.currentTarget);
                                    e.currentTarget.select();
                                  }}
                                  onChange={e => {
                                    setSearchTerm(e.target.value);
                                    setHighlightedItemIndex(0);
                                    if (activeInputRef.current) {
                                      updateDropdownCoords(activeInputRef.current);
                                    }
                                  }}
                                  onKeyDown={e => {
                                    if (activeItemSearchIndex !== i) return;
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setHighlightedItemIndex(prev =>
                                        Math.min(prev + 1, filteredItems.length - 1)
                                      );
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setHighlightedItemIndex(prev => Math.max(prev - 1, 0));
                                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                                      if (filteredItems[highlightedItemIndex]) {
                                        e.preventDefault();
                                        selectItemForCurrentRow(
                                          filteredItems[highlightedItemIndex].no
                                        );
                                      }
                                    } else if (e.key === 'Escape') {
                                      setActiveItemSearchIndex(null);
                                      setDropdownCoords(null);
                                    }
                                  }}
                                  className={`w-full min-w-0 px-1 py-0.5 text-[10px] 2xl:text-[11px] font-medium bg-transparent border rounded focus:outline-none truncate transition-colors ${
                                    activeItemSearchIndex === i
                                      ? 'bg-white dark:bg-slate-800 border-teal-600 ring-1 ring-teal-500 shadow-xs'
                                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                  }`}
                                />

                                {/* Live preview badge directly under input when active and typing */}
                                {activeItemSearchIndex === i && filteredItems[0] && searchTerm.trim() && (
                                  <div className="hidden 2xl:flex items-center justify-between gap-1 text-[9px] text-teal-700 dark:text-teal-400 font-medium px-1.5 py-0.5 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded mt-0.5 truncate">
                                    <span className="truncate">{filteredItems[0].desc}</span>
                                    <span className="font-mono font-bold shrink-0">SRP ₱{f2(filteredItems[0].srp)}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Beginning Inventory */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              {c.auto ? (
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {raw(c.beg)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!canEdit}
                                  value={raw(r.beg)}
                                  onChange={e => handleNumberInput(i, 'beg', e.target.value)}
                                  className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                                />
                              )}
                            </td>

                            {/* Deliveries */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.del)}
                                onChange={e => handleNumberInput(i, 'del', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Doc # */}
                            <td className="p-0.5 border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={r.doc || ''}
                                onChange={e => handleCellChange(i, 'doc', e.target.value)}
                                className="w-full min-w-0 px-0.5 py-0.5 text-[9.5px] 2xl:text-[10.5px] bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none truncate"
                              />
                            </td>

                            {/* Stock Withdrawal */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.wd)}
                                onChange={e => handleNumberInput(i, 'wd', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Transfer From */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.tf)}
                                onChange={e => handleNumberInput(i, 'tf', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Transfer From Location */}
                            <td className="p-0.5 border-r border-slate-200 dark:border-slate-800">
                              <select
                                disabled={!canEdit}
                                value={r.tfl || ''}
                                onChange={e => handleCellChange(i, 'tfl', e.target.value)}
                                className="w-full min-w-0 px-0.5 py-0.5 text-[9px] 2xl:text-[10px] bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none truncate"
                              >
                                <option value=""></option>
                                {state.locs.map(l => (
                                  <option key={l} value={l} className="dark:bg-slate-900">
                                    {l}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Internal Transfer From (Price Changes) */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.itf)}
                                onChange={e => handleNumberInput(i, 'itf', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Transfer To */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.tt)}
                                onChange={e => handleNumberInput(i, 'tt', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Transfer To Location */}
                            <td className="p-0.5 border-r border-slate-200 dark:border-slate-800">
                              <select
                                disabled={!canEdit}
                                value={r.ttl || ''}
                                onChange={e => handleCellChange(i, 'ttl', e.target.value)}
                                className="w-full min-w-0 px-0.5 py-0.5 text-[9px] 2xl:text-[10px] bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none truncate"
                              >
                                <option value=""></option>
                                {state.locs.map(l => (
                                  <option key={l} value={l} className="dark:bg-slate-900">
                                    {l}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Internal Transfer To (Price Changes) */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.itt)}
                                onChange={e => handleNumberInput(i, 'itt', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Bad Order */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.bad)}
                                onChange={e => handleNumberInput(i, 'bad', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Total Goods Available (Calculated) */}
                            <td
                              className={`p-0.5 text-center font-mono tabular-nums font-semibold text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800 bg-teal-50/50 dark:bg-teal-950/30 truncate ${
                                c.tg < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                              }`}
                            >
                              {raw(c.tg)}
                            </td>

                            {/* Ending Inventory */}
                            <td className="p-0.5 text-center font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={raw(r.end)}
                                placeholder={isSoldOut ? 'Sold out' : ''}
                                onChange={e => handleNumberInput(i, 'end', e.target.value)}
                                className="w-full min-w-0 text-center px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                              />
                            </td>

                            {/* Total Goods Sold (Calculated) */}
                            <td
                              className={`p-0.5 text-center font-mono tabular-nums font-semibold text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800 bg-teal-50/50 dark:bg-teal-950/30 truncate ${
                                c.sold < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                              }`}
                            >
                              {raw(c.sold)}
                            </td>

                            {/* SRP */}
                            <td className="p-0.5 text-right font-mono tabular-nums text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 truncate">
                              {acct(c.srp)}
                            </td>

                            {/* Total Sales (Calculated) */}
                            <td
                              className={`p-0.5 px-1 text-right font-mono tabular-nums font-bold text-[10px] 2xl:text-[11px] border-r border-slate-200 dark:border-slate-800 bg-teal-50/50 dark:bg-teal-950/30 truncate ${
                                c.sales < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-900 dark:text-teal-200'
                              }`}
                            >
                              {acct(c.sales)}
                            </td>

                            {/* Delete Action */}
                            {canAdmin && (
                              <td className="p-0.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(i)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                                  title="Delete row"
                                >
                                  ×
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Category Subtotal Row */}
                      <tr className="bg-slate-200/60 dark:bg-slate-800/60 font-semibold border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                        <td colSpan={2} className="border-r border-slate-200 dark:border-slate-800"></td>
                        <td className="py-1 px-1 text-left font-bold text-slate-700 dark:text-slate-300 truncate border-r border-slate-200 dark:border-slate-800">
                          {cat.name} Total
                        </td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.beg)}</td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.del)}</td>
                        <td className="border-r border-slate-200 dark:border-slate-800"></td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.wd)}</td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.tf)}</td>
                        <td className="border-r border-slate-200 dark:border-slate-800"></td>
                        <td
                          className={`py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800 ${
                            catTotals.itf !== catTotals.itt ? 'text-rose-600 dark:text-rose-400 font-bold' : ''
                          }`}
                        >
                          {raw(catTotals.itf)}
                        </td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.tt)}</td>
                        <td className="border-r border-slate-200 dark:border-slate-800"></td>
                        <td
                          className={`py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800 ${
                            catTotals.itf !== catTotals.itt ? 'text-rose-600 dark:text-rose-400 font-bold' : ''
                          }`}
                        >
                          {raw(catTotals.itt)}
                        </td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.bad)}</td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums bg-teal-100/60 dark:bg-teal-950/60 font-bold truncate border-r border-slate-200 dark:border-slate-800">
                          {raw(catTotals.tg)}
                        </td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">{raw(catTotals.end)}</td>
                        <td className="py-1 px-0.5 text-center font-mono tabular-nums bg-teal-100/60 dark:bg-teal-950/60 font-bold truncate border-r border-slate-200 dark:border-slate-800">
                          {raw(catTotals.sold)}
                        </td>
                        <td className="border-r border-slate-200 dark:border-slate-800"></td>
                        <td
                          className={`py-1 px-1 text-right font-mono tabular-nums font-bold bg-teal-100/60 dark:bg-teal-950/60 truncate border-r border-slate-200 dark:border-slate-800 ${
                            catTotals.sales < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-950 dark:text-teal-200'
                          }`}
                        >
                          {acct(catTotals.sales)}
                        </td>
                        {canAdmin && <td></td>}
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Grand Total Footer */}
            {currentRowsWithIndex.length > 0 && (
              <tfoot className="bg-slate-200/90 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={2} className="border-r border-slate-200 dark:border-slate-800"></td>
                  <td className="py-1.5 px-1 text-left uppercase tracking-wide truncate border-r border-slate-200 dark:border-slate-800">Grand Total ({currentShift})</td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + it.c.beg, 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.del), 0))}
                  </td>
                  <td className="border-r border-slate-200 dark:border-slate-800"></td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.wd), 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.tf), 0))}
                  </td>
                  <td className="border-r border-slate-200 dark:border-slate-800"></td>
                  <td
                    className={`py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800 ${
                      currentRowsWithIndex.reduce((s, it) => s + num(it.r.itf), 0) !==
                      currentRowsWithIndex.reduce((s, it) => s + num(it.r.itt), 0)
                        ? 'text-rose-600 dark:text-rose-400'
                        : ''
                    }`}
                  >
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.itf), 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.tt), 0))}
                  </td>
                  <td className="border-r border-slate-200 dark:border-slate-800"></td>
                  <td
                    className={`py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800 ${
                      currentRowsWithIndex.reduce((s, it) => s + num(it.r.itf), 0) !==
                      currentRowsWithIndex.reduce((s, it) => s + num(it.r.itt), 0)
                        ? 'text-rose-600 dark:text-rose-400'
                        : ''
                    }`}
                  >
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.itt), 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.bad), 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums bg-teal-200/50 dark:bg-teal-900/50 truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + it.c.tg, 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + num(it.r.end), 0))}
                  </td>
                  <td className="py-1.5 px-0.5 text-center font-mono tabular-nums bg-teal-200/50 dark:bg-teal-900/50 truncate border-r border-slate-200 dark:border-slate-800">
                    {raw(currentRowsWithIndex.reduce((s, it) => s + it.c.sold, 0))}
                  </td>
                  <td className="border-r border-slate-200 dark:border-slate-800"></td>
                  <td className="py-1.5 px-1 text-right font-mono tabular-nums text-xs bg-teal-200/50 dark:bg-teal-900/50 text-teal-950 dark:text-teal-100 truncate border-r border-slate-200 dark:border-slate-800">
                    ₱{f2(totalSalesDay)}
                  </td>
                  {canAdmin && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Cash Details Card */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-full sm:w-96 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>Cash Details ({currentShift} Shift)</span>
            <span className="font-mono text-[11px] text-slate-500">{fd(currentDate)}</span>
          </div>

          <div className="p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Should be Sales:</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                ₱{acct(totalSalesDay)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <label htmlFor="cash-on-hand-input" className="text-slate-600 dark:text-slate-400">
                Cash on Hand:
              </label>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-mono">₱</span>
                <input
                  id="cash-on-hand-input"
                  type="text"
                  inputMode="decimal"
                  disabled={!canEdit}
                  value={hasCash ? cashOnHandRaw : ''}
                  onChange={e => handleCashChange(e.target.value)}
                  placeholder=""
                  className="w-28 text-right font-mono tabular-nums font-medium px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Over / Short:</span>
              <span
                className={`font-mono tabular-nums font-bold px-2 py-0.5 rounded ${
                  !hasCash
                    ? 'text-slate-400'
                    : overShortVal < 0
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                }`}
              >
                {hasCash ? `₱${acct(overShortVal)}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label htmlFor="cashier-name-select" className="text-slate-600 dark:text-slate-400">
                Cashier Name:
              </label>
              <select
                id="cashier-name-select"
                disabled={!canEdit}
                value={currentCashier}
                onChange={e => handleCashierChange('cashier', e.target.value)}
                className="w-44 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">(Select Cashier)</option>
                {state.cashiers.map(c => (
                  <option key={c} value={c} className="dark:bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="shift-letter-select" className="text-slate-600 dark:text-slate-400">
                Shift:
              </label>
              <select
                id="shift-letter-select"
                disabled={!canEdit}
                value={currentShiftLetter}
                onChange={e => handleShiftChangeLetter(e.target.value)}
                className="w-20 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value=""></option>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </div>
          </div>
        </div>

        {/* Operational guidelines and hints */}
        <div className="flex-1 min-w-[280px] p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1.5">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
            <span>Shift & Inventory Carryover Rules</span>
          </div>
          <p>
            • Selecting a Date displays only entries for that date. The Shift selector toggles between AM Shift and PM Shift.
          </p>
          <p>
            • PM Shift Beginning Inventory automatically inherits from the AM Shift's Ending Inventory.
          </p>
          <p>
            • Dates within the period automatically carry over items with positive ending inventory as the next shift's Beginning Inventory.
          </p>
          <p>
            • If Ending Inventory is left blank or zero, the system marks the item as <strong>"Sold out"</strong> (Total Goods Sold = Total Goods Available).
          </p>
        </div>
      </div>

      {/* Change History Audit Log */}
      <ChangeHistory
        logs={state.log || []}
        currentTab="entry"
        currentLoc={state.inv}
        startDate={state.start}
        cutDate={state.cut}
        canAdmin={canAdmin}
        onDeleteOne={id => {
          onUpdateState(prev => ({
            ...prev,
            log: prev.log.filter(x => x.id !== id)
          }));
        }}
        onDeleteAllShown={ids => {
          const idSet = new Set(ids);
          onUpdateState(prev => ({
            ...prev,
            log: prev.log.filter(x => !idSet.has(x.id || ''))
          }));
        }}
      />

      {/* Floating Real-Time Preview Dropdown for Item Description (Fixed coordinates to avoid overflow clipping) */}
      {activeItemSearchIndex !== null && dropdownCoords && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownCoords.openAbove ? undefined : `${dropdownCoords.top}px`,
            bottom: dropdownCoords.openAbove ? `${window.innerHeight - dropdownCoords.top}px` : undefined,
            left: `${dropdownCoords.left}px`,
            width: `${dropdownCoords.width}px`,
            height: '300px',
            zIndex: 9999
          }}
          className="h-[300px] max-h-[300px] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl p-2 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100"
        >
          {/* Preview Header */}
          <div className="pb-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>
                {searchTerm.trim() ? (
                  <>
                    Previewing items matching <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">"{searchTerm}"</span>
                  </>
                ) : (
                  'Type letters or numbers to preview items'
                )}
              </span>
            </div>
            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Top Match Preview Card when typing letters or numbers */}
          {searchTerm.trim() && filteredItems.length > 0 && (
            <div className="py-2 shrink-0">
              <div
                onClick={() => selectItemForCurrentRow(filteredItems[0].no)}
                className="p-2.5 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-lg border border-teal-200 dark:border-teal-800 cursor-pointer hover:border-teal-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>Top Match Preview</span>
                  </span>
                  <span className="text-[10px] font-medium bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 px-1.5 py-0.5 rounded">
                    Press Enter ↵
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                    {highlightMatch(filteredItems[0].desc, searchTerm)}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-teal-700 dark:text-teal-400 font-mono text-xs sm:text-sm">
                      ₱{f2(filteredItems[0].srp)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">SRP</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable list of matching preview items */}
          <div className="pt-1.5 overflow-y-auto flex-1 min-h-0 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center space-y-1.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  No items match "{searchTerm}"
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Try typing item description or price
                </p>
              </div>
            ) : (
              filteredItems.map((itemChoice, choiceIdx) => {
                const isSelected = highlightedItemIndex === choiceIdx;
                return (
                  <div
                    key={itemChoice.no}
                    ref={isSelected ? highlightedItemRef : null}
                    onClick={() => selectItemForCurrentRow(itemChoice.no)}
                    onMouseEnter={() => setHighlightedItemIndex(choiceIdx)}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-900/50 text-teal-950 dark:text-teal-100 ring-1 ring-teal-500/50'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {highlightMatch(itemChoice.desc, searchTerm)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-teal-700 dark:text-teal-400 text-xs">
                        ₱{f2(itemChoice.srp)}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">SRP</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Tips */}
          <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span>↑↓ Navigate · Enter / Tab to select · Esc to close</span>
            <span>{filteredItems.length} items</span>
          </div>
        </div>
      )}
    </div>
  );

  function handleShiftChangeLetter(val: string) {
    handleCashierChange('shift', val);
  }
};
