import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Download,
  Search,
  Plus,
  ArrowRight,
  DollarSign,
  Package,
  Building2,
  X
} from 'lucide-react';
import { AppState, Item, Row } from '../types';
import {
  acct,
  f2,
  fd,
  num,
  q,
  unitCost,
  today,
  createInitialRow
} from '../utils/helpers';
import { exportTransferFromData } from '../utils/excel';

interface TransferFromTabProps {
  state: AppState;
  canEdit: boolean;
  canAdmin: boolean;
  onUpdateState: (updater: (prev: AppState) => AppState, actionDescription?: string) => void;
  onNavigateToMonthlySummary?: () => void;
}

export const TransferFromTab: React.FC<TransferFromTabProps> = ({
  state,
  canEdit,
  canAdmin,
  onUpdateState,
  onNavigateToMonthlySummary
}) => {
  const [startDate, setStartDate] = useState<string>(state.start);
  const [endDate, setEndDate] = useState<string>(state.cut);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyTransfers, setShowOnlyTransfers] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'both' | 'qty' | 'cost'>('both');

  // Quick Add Transfer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<{
    date: string;
    itemNo: number | '';
    sourceLoc: string;
    qty: string;
    shift: 'AM' | 'PM';
  }>({
    date: state.vd || today(),
    itemNo: state.items.length > 0 ? state.items[0].no : '',
    sourceLoc: state.locs.find(l => l !== state.inv) || state.locs[0] || '',
    qty: '',
    shift: state.vf || 'AM'
  });

  // Available locations: all configured locations plus any found in tfl
  const allLocations = useMemo(() => {
    const locSet = new Set<string>(state.locs);
    state.rows.forEach(r => {
      if (r.tfl && r.tfl.trim()) locSet.add(r.tfl.trim());
    });
    return Array.from(locSet).sort((a, b) => a.localeCompare(b));
  }, [state.locs, state.rows]);

  // Filter rows belonging to the active inventory location within selected date range
  const activeRows = useMemo(() => {
    return state.rows
      .map((r, i) => ({ row: r, index: i }))
      .filter(
        ({ row: r }) =>
          r.loc === state.inv &&
          r.no !== '' &&
          r.date >= startDate &&
          r.date <= endDate
      );
  }, [state.rows, state.inv, startDate, endDate]);

  // Aggregate transfer quantities by item and by source location
  const {
    itemLocQtyMap,
    itemTotalDescQtyMap,
    colTotalsQty
  } = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    const descMap: Record<number, number> = {};
    const colTot: Record<string, number> = {};
    allLocations.forEach(l => {
      colTot[l] = 0;
    });
    colTot['Unassigned'] = 0;

    activeRows.forEach(({ row: r }) => {
      const no = r.no as number;
      const qty = num(r.tf);
      if (!map[no]) map[no] = {};
      descMap[no] = (descMap[no] || 0) + qty;

      if (qty > 0) {
        const srcLoc = (r.tfl || '').trim();
        if (srcLoc) {
          map[no][srcLoc] = (map[no][srcLoc] || 0) + qty;
          colTot[srcLoc] = (colTot[srcLoc] || 0) + qty;
        } else {
          map[no]['Unassigned'] = (map[no]['Unassigned'] || 0) + qty;
          colTot['Unassigned'] = (colTot['Unassigned'] || 0) + qty;
        }
      }
    });

    return {
      itemLocQtyMap: map,
      itemTotalDescQtyMap: descMap,
      colTotalsQty: colTot
    };
  }, [activeRows, allLocations]);

  // 1. DONT SHOW THE LOCATION JUST SHOW THE LOCATION WITH TRANSFERS:
  // Only include locations where total transfer quantity in this period > 0
  const locationsWithTransfers = useMemo(() => {
    const list = allLocations.filter(loc => (colTotalsQty[loc] || 0) > 0);
    if ((colTotalsQty['Unassigned'] || 0) > 0) {
      list.push('Unassigned');
    }
    return list;
  }, [allLocations, colTotalsQty]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    state.items.forEach(it => {
      if (it.cat) set.add(it.cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state.items]);

  // Filter items based on search and selected category
  const filteredItemsByCategory = useMemo(() => {
    const map: Record<string, Item[]> = {};
    const catsToInclude = selectedCategory === 'all' ? categories : [selectedCategory];

    catsToInclude.forEach(cat => {
      const catItems = state.items
        .filter(item => {
          if (item.cat !== cat) return false;
          if (searchTerm) {
            const s = searchTerm.toLowerCase();
            const matchDesc = item.desc.toLowerCase().includes(s);
            const matchCode = (item.code || '').toLowerCase().includes(s);
            if (!matchDesc && !matchCode) return false;
          }
          if (showOnlyTransfers) {
            const locsSum = locationsWithTransfers.reduce(
              (sum, loc) => sum + (itemLocQtyMap[item.no]?.[loc] || 0),
              0
            );
            if (locsSum === 0) return false;
          }
          return true;
        })
        .sort((a, b) => a.desc.localeCompare(b.desc) || a.no - b.no);

      if (catItems.length > 0) {
        map[cat] = catItems;
      }
    });

    return map;
  }, [state.items, selectedCategory, categories, searchTerm, showOnlyTransfers, locationsWithTransfers, itemLocQtyMap]);

  // Categories that have items to display
  const activeCategories = useMemo(() => {
    return Object.keys(filteredItemsByCategory).sort((a, b) => a.localeCompare(b));
  }, [filteredItemsByCategory]);

  // Grand summary values across all categories
  const grandSummary = useMemo(() => {
    let grandQty = 0;
    let grandNetCost = 0;
    const locGrandQty: Record<string, number> = {};
    const locGrandCost: Record<string, number> = {};

    locationsWithTransfers.forEach(l => {
      locGrandQty[l] = 0;
      locGrandCost[l] = 0;
    });

    state.items.forEach(it => {
      const rowQtys = itemLocQtyMap[it.no] || {};
      const uCost = unitCost(it);
      const isVat = it.vat !== 'NVAT';
      const calcNet = (qty: number) => (isVat ? (qty * uCost) / 1.12 : qty * uCost);

      locationsWithTransfers.forEach(loc => {
        const qVal = rowQtys[loc] || 0;
        if (qVal > 0) {
          grandQty += qVal;
          locGrandQty[loc] = (locGrandQty[loc] || 0) + qVal;
          const costVal = calcNet(qVal);
          grandNetCost += costVal;
          locGrandCost[loc] = (locGrandCost[loc] || 0) + costVal;
        }
      });
    });

    return {
      grandQty,
      grandNetCost,
      locGrandQty,
      locGrandCost
    };
  }, [state.items, itemLocQtyMap, locationsWithTransfers]);

  // Handle adding a transfer from the modal
  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseFloat(addForm.qty);
    if (isNaN(qtyNum) || qtyNum <= 0 || addForm.itemNo === '') return;

    const targetItem = state.items.find(x => x.no === addForm.itemNo);
    const itemDesc = targetItem ? targetItem.desc : `Item #${addForm.itemNo}`;

    onUpdateState(prev => {
      const existingRowIdx = prev.rows.findIndex(
        r =>
          r.loc === prev.inv &&
          r.date === addForm.date &&
          r.fr === addForm.shift &&
          r.no === addForm.itemNo
      );

      const nextRows = [...prev.rows];
      if (existingRowIdx >= 0) {
        const curTf = num(nextRows[existingRowIdx].tf);
        nextRows[existingRowIdx] = {
          ...nextRows[existingRowIdx],
          tf: curTf + qtyNum,
          tfl: addForm.sourceLoc
        };
      } else {
        nextRows.push(
          createInitialRow(addForm.itemNo, addForm.date, {
            loc: prev.inv,
            fr: addForm.shift,
            tf: qtyNum,
            tfl: addForm.sourceLoc
          })
        );
      }

      return {
        ...prev,
        rows: nextRows
      };
    }, `Added Transfer From: ${qtyNum}x ${itemDesc} from ${addForm.sourceLoc} (${fd(addForm.date)})`);

    setIsAddModalOpen(false);
    setAddForm(prev => ({ ...prev, qty: '' }));
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 rounded-xl">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Transfer From
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Receiving Branch:{' '}
                  <span className="font-semibold text-teal-800 dark:text-teal-400">
                    {state.inv}
                  </span>{' '}
                  &bull; Period:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {fd(startDate)} to {fd(endDate)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & View Toggle */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  viewMode === 'both'
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Both Tables
              </button>
              <button
                type="button"
                onClick={() => setViewMode('qty')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  viewMode === 'qty'
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Quantity Matrix
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cost')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  viewMode === 'cost'
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Net of VAT Cost
              </button>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Transfer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => exportTransferFromData(state, startDate, endDate, locationsWithTransfers)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Download Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Filters and Date Bar */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          {/* Filter options */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyTransfers}
                onChange={e => setShowOnlyTransfers(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300 dark:border-slate-700 focus:ring-teal-500"
              />
              <span>Only with Transfers</span>
            </label>

            {(startDate !== state.start || endDate !== state.cut) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate(state.start);
                  setEndDate(state.cut);
                }}
                className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
              >
                Reset Period
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Quantity */}
        <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Quantity Transferred
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {q(grandSummary.grandQty) || '0'} <span className="text-xs font-normal text-slate-500">units</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Across {locationsWithTransfers.length} transfer location{locationsWithTransfers.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Monthly Summary Pickup - Total Net of VAT Cost */}
        <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/30 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-1">
              <span>Picked Up in Monthly Summary</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-teal-950 dark:text-teal-200">
              ₱{acct(grandSummary.grandNetCost)}
            </div>
            <div className="mt-1 text-xs text-teal-700 dark:text-teal-400 leading-tight">
              Total Net of VAT Transfers FROM
            </div>
          </div>
          <div className="p-2.5 bg-teal-200/80 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 rounded-xl shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Source Locations with Transfers */}
        <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Locations with Transfers
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {locationsWithTransfers.length === 0
                ? 'None'
                : `${locationsWithTransfers.length} Branch${locationsWithTransfers.length === 1 ? '' : 'es'}`}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
              {locationsWithTransfers.length > 0 ? locationsWithTransfers.join(', ') : 'No transfers recorded'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* When no locations have transfers */}
      {locationsWithTransfers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 text-slate-500 italic shadow-xs space-y-2">
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
            No transfer from locations with recorded transfers.
          </p>
          <p className="text-xs">
            There are no transfer records for <strong>{state.inv}</strong> between {fd(startDate)} and {fd(endDate)}.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record a Transfer Now</span>
            </button>
          )}
        </div>
      ) : activeCategories.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 text-slate-500 italic shadow-xs">
          No items match the current search or filter criteria.
        </div>
      ) : (
        /* Render separate tables for each category */
        <div className="space-y-6">
          {activeCategories.map(cat => {
            const items = filteredItemsByCategory[cat] || [];

            // Compute category-level column totals
            const catColTotalsQty: Record<string, number> = {};
            const catColTotalsCost: Record<string, number> = {};
            locationsWithTransfers.forEach(l => {
              catColTotalsQty[l] = 0;
              catColTotalsCost[l] = 0;
            });

            items.forEach(it => {
              const rowQtys = itemLocQtyMap[it.no] || {};
              const uCost = unitCost(it);
              const isVat = it.vat !== 'NVAT';
              const calcNet = (qty: number) => (isVat ? (qty * uCost) / 1.12 : qty * uCost);

              locationsWithTransfers.forEach(loc => {
                const qVal = rowQtys[loc] || 0;
                catColTotalsQty[loc] = (catColTotalsQty[loc] || 0) + qVal;
                catColTotalsCost[loc] = (catColTotalsCost[loc] || 0) + calcNet(qVal);
              });
            });

            return (
              <div key={cat} className="space-y-4">
                {/* 1. QUANTITY TABLE FOR THIS CATEGORY */}
                {(viewMode === 'both' || viewMode === 'qty') && (
                  <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-teal-900 dark:text-teal-300">
                        {cat} — Transfer From (Quantity)
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {items.length} item{items.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="overflow-x-auto w-full pb-2">
                      <table className="w-full text-[11px] border-collapse leading-tight font-sans">
                        <thead className="bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-300 dark:border-slate-700">
                          <tr className="align-middle">
                            {/* Just Item Description */}
                            <th className="py-2 px-3 text-left min-w-[240px] border-r border-slate-300 dark:border-slate-700">
                              Item Description
                            </th>
                            {/* Only Locations with Transfers */}
                            {locationsWithTransfers.map(loc => (
                              <th
                                key={loc}
                                className="py-2 px-3 text-center min-w-[140px] border-r border-slate-300 dark:border-slate-700 last:border-r-0"
                              >
                                {loc}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.map(it => {
                            const rowQtys = itemLocQtyMap[it.no] || {};
                            return (
                              <tr
                                key={it.no}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                {/* Just Item Description */}
                                <td className="py-1.5 px-3 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                                  {it.desc}
                                </td>

                                {/* Quantities by Location */}
                                {locationsWithTransfers.map(loc => {
                                  const val = rowQtys[loc] || 0;
                                  return (
                                    <td
                                      key={loc}
                                      className={`py-1.5 px-3 text-center font-mono tabular-nums border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${
                                        val > 0
                                          ? 'font-bold text-teal-800 dark:text-teal-300'
                                          : 'text-slate-300 dark:text-slate-600'
                                      }`}
                                    >
                                      {val > 0 ? q(val) : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-200/90 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 border-t-2 border-slate-300 dark:border-slate-700">
                          <tr>
                            <td className="py-2 px-3 text-left border-r border-slate-300 dark:border-slate-700 uppercase text-[10px] tracking-wider">
                              Total
                            </td>
                            {locationsWithTransfers.map(loc => {
                              const total = catColTotalsQty[loc] || 0;
                              return (
                                <td
                                  key={loc}
                                  className="py-2 px-3 text-center font-mono tabular-nums border-r border-slate-300 dark:border-slate-700 last:border-r-0 text-teal-900 dark:text-teal-300"
                                >
                                  {total > 0 ? q(total) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. NET OF VAT COST TABLE FOR THIS CATEGORY */}
                {(viewMode === 'both' || viewMode === 'cost') && (
                  <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="bg-teal-50 dark:bg-teal-950/60 px-4 py-2.5 border-b border-teal-200 dark:border-teal-900/60 flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        <span>{cat} — Transfer From (Net of VAT Cost)</span>
                      </span>
                      <span className="text-[10px] text-teal-700 dark:text-teal-400">
                        Picked up in Monthly Summary
                      </span>
                    </div>

                    <div className="overflow-x-auto w-full pb-2">
                      <table className="w-full text-[11px] border-collapse leading-tight font-sans">
                        <thead className="bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-300 dark:border-slate-700">
                          <tr className="align-middle">
                            {/* Just Item Description */}
                            <th className="py-2 px-3 text-left min-w-[240px] border-r border-slate-300 dark:border-slate-700">
                              Item Description
                            </th>
                            {/* Only Locations with Transfers */}
                            {locationsWithTransfers.map(loc => (
                              <th
                                key={loc}
                                className="py-2 px-3 text-center min-w-[140px] border-r border-slate-300 dark:border-slate-700 last:border-r-0"
                              >
                                {loc}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.map(it => {
                            const rowQtys = itemLocQtyMap[it.no] || {};
                            const uCost = unitCost(it);
                            const isVat = it.vat !== 'NVAT';
                            const calcNet = (qty: number) => (isVat ? (qty * uCost) / 1.12 : qty * uCost);

                            return (
                              <tr
                                key={it.no}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                {/* Just Item Description */}
                                <td className="py-1.5 px-3 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                                  {it.desc}
                                </td>

                                {/* Net of VAT Cost by Location */}
                                {locationsWithTransfers.map(loc => {
                                  const qVal = rowQtys[loc] || 0;
                                  const cost = calcNet(qVal);
                                  return (
                                    <td
                                      key={loc}
                                      className={`py-1.5 px-3 text-right font-mono tabular-nums border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${
                                        cost > 0
                                          ? 'font-bold text-teal-800 dark:text-teal-300'
                                          : 'text-slate-300 dark:text-slate-600'
                                      }`}
                                    >
                                      {cost > 0 ? acct(cost) : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-teal-100/70 dark:bg-teal-950/80 font-bold text-slate-800 dark:text-slate-200 border-t-2 border-teal-300 dark:border-teal-800">
                          <tr>
                            <td className="py-2 px-3 text-left border-r border-teal-200 dark:border-teal-800 uppercase text-[10px] tracking-wider text-teal-950 dark:text-teal-200">
                              Total Net of VAT Cost
                            </td>
                            {locationsWithTransfers.map(loc => {
                              const totalCost = catColTotalsCost[loc] || 0;
                              return (
                                <td
                                  key={loc}
                                  className="py-2 px-3 text-right font-mono tabular-nums border-r border-teal-200 dark:border-teal-800 last:border-r-0 text-teal-950 dark:text-teal-200"
                                >
                                  {totalCost > 0 ? acct(totalCost) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand Summary Across All Categories */}
          {activeCategories.length > 1 && (
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Grand Total Summary (All Categories)
                </span>
                {onNavigateToMonthlySummary && (
                  <button
                    type="button"
                    onClick={onNavigateToMonthlySummary}
                    className="text-xs text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View in Monthly Summary</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {locationsWithTransfers.map(loc => (
                  <div
                    key={loc}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                  >
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate" title={loc}>
                      {loc}
                    </div>
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {q(grandSummary.locGrandQty[loc])} <span className="text-xs font-normal text-slate-500">units</span>
                    </div>
                    <div className="text-xs font-mono font-semibold text-teal-800 dark:text-teal-400">
                      ₱{acct(grandSummary.locGrandCost[loc])} Net of VAT
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Transfer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-teal-600" />
                <span>Record Transfer From</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Date
                </label>
                <input
                  type="date"
                  required
                  value={addForm.date}
                  onChange={e => setAddForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shift
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddForm(prev => ({ ...prev, shift: 'AM' }))}
                    className={`py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                      addForm.shift === 'AM'
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 text-teal-800 dark:text-teal-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    AM Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm(prev => ({ ...prev, shift: 'PM' }))}
                    className={`py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                      addForm.shift === 'PM'
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 text-teal-800 dark:text-teal-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    PM Shift
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Item Description
                </label>
                <select
                  value={addForm.itemNo}
                  onChange={e => setAddForm(prev => ({ ...prev, itemNo: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  {state.items.map(it => (
                    <option key={it.no} value={it.no}>
                      {it.desc} ({it.cat})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer From Location (Source Branch)
                </label>
                <select
                  value={addForm.sourceLoc}
                  onChange={e => setAddForm(prev => ({ ...prev, sourceLoc: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  {allLocations.map(loc => (
                    <option key={loc} value={loc}>
                      {loc} {loc === state.inv ? '(Current Branch)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="e.g. 5"
                  value={addForm.qty}
                  onChange={e => setAddForm(prev => ({ ...prev, qty: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 rounded-lg cursor-pointer shadow-xs"
                >
                  Save Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
