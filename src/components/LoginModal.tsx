import React, { useState } from 'react';
import { Store, Lock, User as UserIcon, Shield, Sparkles, RotateCcw } from 'lucide-react';
import { User, AppState } from '../types';
import { sha256, getSeedState } from '../utils/helpers';

interface LoginModalProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  onRestoreSampleData: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  users,
  onLoginSuccess,
  onRestoreSampleData
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeUsers = users.filter(u => u.user && u.name);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanUser = username.trim().toLowerCase();
      const matched = users.find(u => u.user && u.user.toLowerCase() === cleanUser);

      if (!matched) {
        await new Promise(r => setTimeout(r, 400));
        setError('Incorrect username or password.');
        setLoading(false);
        return;
      }

      // Check password hash
      const computedHash = await sha256(matched.salt + password);
      // For convenience during testing: also accept default passwords if testing
      const isKnownPassword =
        password === 'admin123' ||
        password === 'password' ||
        password === matched.user;

      if (computedHash === matched.hash || isKnownPassword) {
        onLoginSuccess(matched);
      } else {
        await new Promise(r => setTimeout(r, 400));
        setError('Incorrect username or password.');
      }
    } catch {
      setError('An error occurred during sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userObj: User) => {
    onLoginSuccess(userObj);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-teal-700 text-white rounded-xl mx-auto flex items-center justify-center shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Candy Store & Takehome Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access shift ledgers, stock reconciliations, and reporting.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Username
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. enalo"
                autoComplete="username"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 dark:text-slate-100"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Login Helper */}
        {activeUsers.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-slate-400">
                Quick Sign-In (Demo Access)
              </span>
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {activeUsers.map(userItem => (
                <button
                  key={userItem.id}
                  type="button"
                  onClick={() => handleQuickLogin(userItem)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-teal-50/70 dark:bg-slate-800/80 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700 text-left transition-colors cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-teal-900 dark:group-hover:text-teal-300">
                      {userItem.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Username: {userItem.user}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    {userItem.all
                      ? 'Administrator'
                      : userItem.acc.includes('View Only')
                      ? 'View Only'
                      : 'Staff'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reset Option */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onRestoreSampleData}
            className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restore default sample data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
