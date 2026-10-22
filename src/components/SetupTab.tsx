import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Users2,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { AppState } from '../types';
import { fd, getSeedState } from '../utils/helpers';
import { ChangeHistory } from './ChangeHistory';

interface SetupTabProps {
  state: AppState;
  canAdmin: boolean;
  canChangeLoc: boolean;
  canChangeStart: boolean;
  canChangeCut: boolean;
  onUpdateState: (updater: (prev: AppState) => AppState, actionDescription?: string) => void;
  onAskConfirm: (message: string, onConfirm: () => void) => void;
}

export const SetupTab: React.FC<SetupTabProps> = ({
  state,
  canAdmin,
  canChangeLoc,
  canChangeStart,
  canChangeCut,
  onUpdateState,
  onAskConfirm
}) => {
  const [msg, setMsg] = useState('');

  const handleInvLocationChange = (newLoc: string) => {
    onUpdateState(
      prev => ({ ...prev, inv: newLoc }),
      `Inventory Location: "${state.inv}" → "${newLoc}"`
    );
  };

  const handleStartDateChange = (newStart: string) => {
    onUpdateState(
      prev => ({ ...prev, start: newStart }),
      `Start Date: ${fd(state.start)} → ${fd(newStart)}`
    );
  };

  const handleCutDateChange = (newCut: string) => {
    onUpdateState(
      prev => ({ ...prev, cut: newCut }),
      `Cut Off Date: ${fd(state.cut)} → ${fd(newCut)}`
    );
  };

  // Location rename
  const handleRenameLocation = (index: number, newName: string) => {
    const oldName = state.locs[index];
    const clean = newName.trim();
    if (!clean || clean === oldName) return;

    onUpdateState(prev => {
      const updatedLocs = [...prev.locs];
      updatedLocs[index] = clean;

      // Propagate location rename
      const updatedRows = prev.rows.map(r => ({
        ...r,
        loc: r.loc === oldName ? clean : r.loc,
        tfl: r.tfl === oldName ? clean : r.tfl,
        ttl: r.ttl === oldName ? clean : r.ttl
      }));

      const updatedCash: Record<string, number | ''> = {};
      Object.keys(prev.cash).forEach(k => {
        if (k.startsWith(oldName + '|')) {
          updatedCash[clean + '|' + k.slice(oldName.length + 1)] = prev.cash[k];
        } else {
          updatedCash[k] = prev.cash[k];
        }
      });

      const updatedCinfo: Record<string, any> = {};
      Object.keys(prev.cinfo).forEach(k => {
        if (k.startsWith(oldName + '|')) {
          updatedCinfo[clean + '|' + k.slice(oldName.length + 1)] = prev.cinfo[k];
        } else {
          updatedCinfo[k] = prev.cinfo[k];
        }
      });

      const updatedCpay: Record<string, number> = {};
      Object.keys(prev.cpay).forEach(k => {
        if (k.startsWith(oldName + '|')) {
          updatedCpay[clean + '|' + k.slice(oldName.length + 1)] = prev.cpay[k];
        } else {
          updatedCpay[k] = prev.cpay[k];
        }
      });

      const updatedUsers = prev.users.map(u => ({
        ...u,
        locs: u.locs.map(l => (l === oldName ? clean : l))
      }));

      return {
        ...prev,
        locs: updatedLocs,
        inv: prev.inv === oldName ? clean : prev.inv,
        rows: updatedRows,
        cash: updatedCash,
        cinfo: updatedCinfo,
        cpay: updatedCpay,
        users: updatedUsers
      };
    }, `Location renamed: "${oldName}" → "${clean}"`);
  };

  const handleAddLocation = () => {
    const name = `Takehome Branch ${state.locs.length + 1}`;
    onUpdateState(
      prev => ({
        ...prev,
        locs: [...prev.locs, name]
      }),
      `Location added: ${name}`
    );
  };

  const handleDeleteLocation = (index: number) => {
    const loc = state.locs[index];
    onAskConfirm(`Remove branch location "${loc}"?`, () => {
      onUpdateState(
        prev => {
          const newLocs = prev.locs.filter((_, i) => i !== index);
          return {
            ...prev,
            locs: newLocs,
            inv: prev.inv === loc ? newLocs[0] || '' : prev.inv,
            users: prev.users.map(u => ({
              ...u,
              locs: u.locs.filter(l => l !== loc)
            }))
          };
        },
        `Location removed: ${loc}`
      );
    });
  };

  // Cashier rename
  const handleRenameCashier = (index: number, newName: string) => {
    const oldName = state.cashiers[index];
    const clean = newName.trim();
    if (!clean || clean === oldName) return;

    onUpdateState(prev => {
      const nextCashiers = [...prev.cashiers];
      nextCashiers[index] = clean;

      const nextCinfo = { ...prev.cinfo };
      Object.keys(nextCinfo).forEach(k => {
        if (nextCinfo[k]?.cashier === oldName) {
          nextCinfo[k] = { ...nextCinfo[k], cashier: clean };
        }
      });

      return {
        ...prev,
        cashiers: nextCashiers,
        cinfo: nextCinfo
      };
    }, `Cashier renamed: "${oldName}" → "${clean}"`);
  };

  const handleAddCashier = () => {
    const name = `Cashier ${state.cashiers.length + 1}`;
    onUpdateState(
      prev => ({
        ...prev,
        cashiers: [...prev.cashiers, name]
      }),
      `Cashier added: ${name}`
    );
  };

  const handleDeleteCashier = (index: number) => {
    const name = state.cashiers[index];
    onAskConfirm(`Remove cashier "${name}"?`, () => {
      onUpdateState(
        prev => ({
          ...prev,
          cashiers: prev.cashiers.filter((_, i) => i !== index)
        }),
        `Cashier removed: ${name}`
      );
    });
  };

  const handleRestoreSampleData = () => {
    onAskConfirm(
      'Replace all settings, locations, cashiers, item master, and data entries with the default sample data?\n(Existing change logs will be retained).',
      () => {
        const seed = getSeedState();
        onUpdateState(
          prev => ({
            ...seed,
            log: [
              ...prev.log,
              {
                t: new Date().toISOString(),
                u: 'Admin',
                tab: 'setup',
                act: 'Restored sample data',
                desc: 'All settings and records reset to default sample dataset',
                loc: seed.inv
              }
            ]
          }),
          'Sample data restored'
        );
        setMsg('Sample data has been restored successfully.');
      }
    );
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-800 dark:text-teal-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            {msg}
          </span>
          <button onClick={() => setMsg('')} className="font-bold text-teal-700 hover:text-teal-900">
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Inventory Period Card */}
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm pb-2 border-b border-slate-200 dark:border-slate-800">
            <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>Inventory Period & Active Branch</span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Active Inventory Location:
              </label>
              <select
                disabled={!canChangeLoc}
                value={state.inv}
                onChange={e => handleInvLocationChange(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 cursor-pointer"
              >
                {state.locs.map(l => (
                  <option key={l} value={l} className="dark:bg-slate-900">
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Start Date:
                </label>
                <input
                  type="date"
                  disabled={!canChangeStart}
                  value={state.start}
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Cut Off Date:
                </label>
                <input
                  type="date"
                  disabled={!canChangeCut}
                  value={state.cut}
                  onChange={e => handleCutDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* System & Data Management Card */}
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm pb-2 border-b border-slate-200 dark:border-slate-800">
            <RotateCcw className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>Sample Data & Factory Reset</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Need to test sample records or start fresh? Restoring sample data populates standard test
            items, past shift records, and sample branch locations.
          </p>

          {canAdmin && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRestoreSampleData}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restore Sample Data</span>
              </button>
            </div>
          )}
        </div>

        {/* Locations Manager Card */}
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
              <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Branch Locations ({state.locs.length})</span>
            </div>
            {canAdmin && (
              <button
                type="button"
                onClick={handleAddLocation}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add location</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {state.locs.map((loc, i) => (
              <div key={i} className="flex items-center gap-1.5 min-w-0">
                <input
                  type="text"
                  disabled={!canAdmin}
                  defaultValue={loc}
                  onBlur={e => handleRenameLocation(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 truncate"
                />
                {canAdmin && state.locs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(i)}
                    className="p-1.5 shrink-0 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Remove location"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cashier Names Manager Card */}
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
              <Users2 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Cashier Directory ({state.cashiers.length})</span>
            </div>
            {canAdmin && (
              <button
                type="button"
                onClick={handleAddCashier}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add cashier</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {state.cashiers.map((cashier, i) => (
              <div key={i} className="flex items-center gap-1.5 min-w-0">
                <input
                  type="text"
                  disabled={!canAdmin}
                  defaultValue={cashier}
                  onBlur={e => handleRenameCashier(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 truncate"
                />
                {canAdmin && state.cashiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCashier(i)}
                    className="p-1.5 shrink-0 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Remove cashier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change History Audit Log */}
      <ChangeHistory
        logs={state.log || []}
        currentTab="setup"
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
