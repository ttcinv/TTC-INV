import React from 'react';
import {
  Store,
  Calendar,
  User as UserIcon,
  KeyRound,
  LogOut,
  MapPin,
  Moon,
  Sun
} from 'lucide-react';
import { User } from '../types';
import { fd } from '../utils/helpers';

interface HeaderProps {
  user: User | null;
  currentLoc: string;
  startDate: string;
  cutDate: string;
  availableLocs: string[];
  canChangeLoc: boolean;
  onSelectLoc: (loc: string) => void;
  onChangePassword: () => void;
  onSignOut: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentLoc,
  startDate,
  cutDate,
  availableLocs,
  canChangeLoc,
  onSelectLoc,
  onChangePassword,
  onSignOut,
  darkMode,
  onToggleDarkMode
}) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight truncate">
                Candy Store & Takehome Inventory
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 font-medium text-teal-800 dark:text-teal-400">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{currentLoc || 'No Location'}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>
                    {fd(startDate)} to {fd(cutDate)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right actions: Location picker if allowed, User badge, Password & Sign out */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {canChangeLoc && availableLocs.length > 1 && (
              <div className="hidden md:flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <label htmlFor="quick-loc-select" className="text-slate-500 text-[11px] font-medium">
                  Branch:
                </label>
                <select
                  id="quick-loc-select"
                  value={currentLoc}
                  onChange={e => onSelectLoc(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                >
                  {availableLocs.map(l => (
                    <option key={l} value={l} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                    {user.name || user.user}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {user.all ? 'Administrator' : user.acc.includes('View Only') ? 'View Only' : 'Staff'}
                  </span>
                </div>

                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>

                <button
                  type="button"
                  onClick={onChangePassword}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
                  title="Change Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
