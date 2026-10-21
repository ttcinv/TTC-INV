import React, { useState, useRef } from 'react';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Search,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { AppState, Item } from '../types';
import { acct, f2, num, raw, unitCost } from '../utils/helpers';
import { exportItemMaster, parseItemImport } from '../utils/excel';
import { ChangeHistory } from './ChangeHistory';
import * as XLSX from 'xlsx';

interface ItemMasterTabProps {
  state: AppState;
  canEdit: boolean;
  canAdmin: boolean;
  onUpdateState: (updater: (prev: AppState) => AppState, actionDescription?: string) => void;
  onAskConfirm: (message: string, onConfirm: () => void) => void;
}

export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({
  state,
  canEdit,
  canAdmin,
  onUpdateState,
  onAskConfirm
}) => {
  const [search, setSearch] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = state.items.filter(it => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      it.desc.toLowerCase().includes(s) ||
      it.code.toLowerCase().includes(s) ||
      it.cat.toLowerCase().includes(s) ||
      it.sys.toLowerCase().includes(s) ||
      String(it.no).includes(s)
    );
  });

  const handleCellChange = (itemNo: number, field: keyof Item, value: any) => {
    onUpdateState(prev => {
      const newItems = prev.items.map(it => {
        if (it.no === itemNo) {
          return { ...it, [field]: value };
        }
        return it;
      });
      return { ...prev, items: newItems };
    });
  };

  const handleNumberInput = (itemNo: number, field: keyof Item, rawStr: string) => {
    const clean = rawStr.trim() === '' ? '' : parseFloat(rawStr.replace(/,/g, ''));
    const val = isNaN(clean as number) ? 0 : clean;
    handleCellChange(itemNo, field, val);
  };

  const handleAddItem = () => {
    const maxNo = state.items.reduce((m, x) => Math.max(m, x.no), 0);
    const newNo = maxNo + 1;

    const newItem: Item = {
      no: newNo,
      code: '',
      sys: '',
      desc: '',
      cat: '',
      srp: 0,
      loc: 'Pastry',
      vat: 'VAT',
      deliv: 0,
      conv: 0,
      wd: 0,
      cv: 1
    };

    onUpdateState(
      prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }),
      `Line ${newNo} added to Item Master`
    );
  };

  const handleDeleteItem = (itemNo: number) => {
    const it = state.items.find(x => x.no === itemNo);
    const label = it?.desc || it?.code || `Line ${itemNo}`;

    onAskConfirm(
      `Delete line ${itemNo} (${label})?\nData Entry rows using it will become blank.`,
      () => {
        onUpdateState(
          prev => ({
            ...prev,
            items: prev.items.filter(x => x.no !== itemNo)
          }),
          `Line ${itemNo} (${label}, SRP ₱${f2(it?.srp)}) deleted from Item Master`
        );
      }
    );
  };

  const handleDeleteAllItems = () => {
    onAskConfirm(
      `Delete ALL ${state.items.length} items from the Item Master?\nData Entry rows that use them will show blank item names.`,
      () => {
        onUpdateState(
          prev => ({
            ...prev,
            items: []
          }),
          `All ${state.items.length} items deleted from Item Master`
        );
      }
    );
  };

  // Import handler
  const handleImportSubmit = () => {
    if (!importText.trim()) {
      setMsg('Please paste rows into the text box first.');
      return;
    }

    try {
      const lines = importText.trim().split(/\r?\n/).map(line => line.split(/[\t,]/));
      const result = parseItemImport(lines, state.items);
      if (result.error) {
        setMsg(result.error);
        return;
      }

      onUpdateState(
        prev => ({
          ...prev,
          items: result.items
        }),
        `Imported items: ${result.updated} updated, ${result.added} added`
      );
      setMsg(`Imported: ${result.updated} updated, ${result.added} added.`);
      setShowImportBox(false);
      setImportText('');
    } catch {
      setMsg('Error parsing the pasted data.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const sheetRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const result = parseItemImport(sheetRows, state.items);
        if (result.error) {
          setMsg(result.error);
          return;
        }

        onUpdateState(
          prev => ({
            ...prev,
            items: result.items
          }),
          `Imported items: ${result.updated} updated, ${result.added} added`
        );
        setMsg(`Import complete: ${result.updated} updated, ${result.added} added.`);
        setShowImportBox(false);
      } catch {
        setMsg('Could not read Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items by name, code, category..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add item</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowImportBox(!showImportBox)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Import (Upload)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportItemMaster(state.items)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export (Download)</span>
          </button>

          {canAdmin && state.items.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllItems}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete all items</span>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-800 dark:text-teal-300 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="font-bold text-teal-700 hover:text-teal-900">
            ×
          </button>
        </div>
      )}

      {/* Import dialog card */}
      {showImportBox && (
        <div className="p-4 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Import Item Master</span>
            </h3>
            <button
              onClick={() => setShowImportBox(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
            Choose an Excel file (.xlsx, .csv) with the header row, or paste rows copied from Excel.
            Lines matching an existing Line No. will be updated, and new lines will be created automatically.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-700 file:text-white hover:file:bg-teal-800"
            />
          </div>

          <textarea
            rows={4}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Or paste Excel table rows here directly..."
            className="w-full p-2.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImportBox(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImportSubmit}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              Import items
            </button>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs border-collapse leading-tight ledger-table font-sans">
            <thead className="bg-slate-200/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold sticky top-0 border-b border-slate-300 dark:border-slate-700 z-10">
              <tr>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-300 dark:border-slate-700">
                  Line #
                </th>
                <th className="py-2.5 px-2 text-left w-24 border-r border-slate-300 dark:border-slate-700">
                  Item Code
                </th>
                <th className="py-2.5 px-2 text-left min-w-[180px] border-r border-slate-300 dark:border-slate-700">
                  System Description
                </th>
                <th className="py-2.5 px-2 text-left min-w-[180px] border-r border-slate-300 dark:border-slate-700">
                  Item Description
                </th>
                <th className="py-2.5 px-2 text-left w-24 border-r border-slate-300 dark:border-slate-700">
                  Category
                </th>
                <th className="py-2.5 px-2 text-right w-20 border-r border-slate-300 dark:border-slate-700">
                  SRP (₱)
                </th>
                <th className="py-2.5 px-2 text-left w-24 border-r border-slate-300 dark:border-slate-700">
                  Location
                </th>
                <th className="py-2.5 px-2 text-center w-20 border-r border-slate-300 dark:border-slate-700">
                  Cost Type
                </th>
                <th className="py-2.5 px-2 text-right w-20 border-r border-slate-300 dark:border-slate-700">
                  Delivery Cost
                </th>
                <th className="py-2.5 px-2 text-right w-20 border-r border-slate-300 dark:border-slate-700">
                  Stock W/D
                </th>
                <th className="py-2.5 px-2 text-center w-16 border-r border-slate-300 dark:border-slate-700">
                  Conversion
                </th>
                <th className="py-2.5 px-2 text-right w-20 bg-teal-50 dark:bg-teal-950/40 border-r border-slate-300 dark:border-slate-700 font-semibold">
                  Unit Cost
                </th>
                {canAdmin && <th className="py-2.5 px-1.5 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={canAdmin ? 13 : 12} className="py-12 text-center text-slate-500 italic">
                    {search ? 'No items match your search.' : 'No items yet. Select "Add item" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map(it => {
                  const uCost = unitCost(it);

                  return (
                    <tr key={it.no} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {/* Line # */}
                      <td className="py-1 px-2 text-center font-mono tabular-nums text-slate-500 border-r border-slate-200 dark:border-slate-800">
                        {it.no}
                      </td>

                      {/* Item Code */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={it.code}
                          onChange={e => handleCellChange(it.no, 'code', e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs font-mono bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* System Description */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={it.sys}
                          onChange={e => handleCellChange(it.no, 'sys', e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* Item Description */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={it.desc}
                          onChange={e => handleCellChange(it.no, 'desc', e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* Category */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={it.cat}
                          onChange={e => handleCellChange(it.no, 'cat', e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* SRP */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-right">
                        <input
                          type="number"
                          step="any"
                          disabled={!canEdit}
                          value={raw(it.srp)}
                          onChange={e => handleNumberInput(it.no, 'srp', e.target.value)}
                          className="w-full text-right font-mono tabular-nums px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none font-bold text-teal-900 dark:text-teal-300"
                        />
                      </td>

                      {/* Location */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={it.loc}
                          onChange={e => handleCellChange(it.no, 'loc', e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* Cost Type VAT / NVAT */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center">
                        <select
                          disabled={!canEdit}
                          value={it.vat}
                          onChange={e => handleCellChange(it.no, 'vat', e.target.value)}
                          className="text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none px-1 py-0.5"
                        >
                          <option value="VAT" className="dark:bg-slate-900">
                            VAT
                          </option>
                          <option value="NVAT" className="dark:bg-slate-900">
                            NVAT
                          </option>
                        </select>
                      </td>

                      {/* Delivery Cost */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-right">
                        <input
                          type="number"
                          step="any"
                          disabled={!canEdit}
                          value={raw(it.deliv)}
                          onChange={e => handleNumberInput(it.no, 'deliv', e.target.value)}
                          className="w-full text-right font-mono tabular-nums px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* Stock Withdrawal */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-right">
                        <input
                          type="number"
                          step="any"
                          disabled={!canEdit}
                          value={raw(it.wd)}
                          onChange={e => handleNumberInput(it.no, 'wd', e.target.value)}
                          className="w-full text-right font-mono tabular-nums px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* Conversion */}
                      <td className="p-1 border-r border-slate-200 dark:border-slate-800 text-center">
                        <input
                          type="number"
                          step="any"
                          disabled={!canEdit}
                          value={raw(it.cv)}
                          onChange={e => handleNumberInput(it.no, 'cv', e.target.value)}
                          className="w-full text-center font-mono tabular-nums px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                        />
                      </td>

                      {/* Calculated Unit Cost */}
                      <td className="py-1 px-2 text-right font-mono tabular-nums border-r border-slate-200 dark:border-slate-800 bg-teal-50/50 dark:bg-teal-950/30 font-medium text-slate-800 dark:text-slate-200">
                        {num(it.cv) > 0 ? acct(uCost) : ''}
                      </td>

                      {/* Delete */}
                      {canAdmin && (
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(it.no)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                            title="Delete item"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanatory guidelines */}
      <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        • <strong>Central Item Master:</strong> Shared across all takehome branch locations. Data Entry pulls SRP and item details directly from this master.
        <br />• <strong>Price Changes:</strong> A price change creates a dedicated line (same item code, new SRP). Internal transfers reconcile price adjustments.
        <br />• <strong>Unit Cost:</strong> Automatically calculated as Delivery Cost ÷ Conversion.
      </div>

      {/* Change History Audit Log */}
      <ChangeHistory
        logs={state.log || []}
        currentTab="master"
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
    </div>
  );
};
