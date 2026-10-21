import React from 'react';
import {
  FileSpreadsheet,
  Settings,
  Users,
  Database,
  BarChart3,
  CalendarDays,
  Coins,
  TrendingUp
} from 'lucide-react';
import { getWeeksCount } from '../utils/helpers';

interface TabsNavProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  startDate: string;
  cutDate: string;
}

export const TabsNav: React.FC<TabsNavProps> = ({
  currentTab,
  onSelectTab,
  startDate,
  cutDate
}) => {
  const weeks = getWeeksCount(startDate, cutDate);

  const mainTabs = [
    { id: 'entry', label: 'Data Entry', icon: FileSpreadsheet },
    ...Array.from({ length: weeks }, (_, k) => ({
      id: `w${k + 1}`,
      label: `Week ${k + 1} Summary`,
      icon: CalendarDays
    })),
    { id: 'mo', label: 'Monthly Summary', icon: BarChart3 },
    { id: 'pnl', label: 'Profit and Loss', icon: TrendingUp },
    { id: 'cash', label: 'Cash Details Summary', icon: Coins },
    { id: 'master', label: 'Item Master', icon: Database },
    { id: 'users', label: 'User Access', icon: Users },
    { id: 'setup', label: 'Setup', icon: Settings }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6">
        <nav
          className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none"
          aria-label="Tabs"
        >
          {mainTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold border-b-2 border-teal-700 dark:border-teal-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
