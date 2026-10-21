import React, { useState } from 'react';
import { Plus, Trash2, Shield, UserPlus, Key } from 'lucide-react';
import { AppState, User } from '../types';
import { sha256, rnd } from '../utils/helpers';
import { ChangeHistory } from './ChangeHistory';

interface UsersTabProps {
  state: AppState;
  canAdmin: boolean;
  onUpdateState: (updater: (prev: AppState) => AppState, actionDescription?: string) => void;
  onAskConfirm: (message: string, onConfirm: () => void) => void;
}

const ACCESS_OPTIONS = ['All', 'View Only', 'Inventory Location', 'Start Date', 'Cut Off Date'];
const RESTRICTION_OPTIONS = ['Inventory Location', 'Start Date', 'Cut Off Date'];

export const UsersTab: React.FC<UsersTabProps> = ({
  state,
  canAdmin,
  onUpdateState,
  onAskConfirm
}) => {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const handleAddUser = () => {
    const maxId = state.users.reduce((m, u) => Math.max(m, u.id), 0);
    const newUser: User = {
      id: maxId + 1,
      name: '',
      all: false,
      locs: [],
      acc: ['View Only'],
      res: [],
      user: '',
      salt: '',
      hash: ''
    };

    onUpdateState(
      prev => ({
        ...prev,
        users: [...prev.users, newUser]
      }),
      `New user line added (#${maxId + 1})`
    );
  };

  const handleDeleteUser = (userId: number) => {
    const u = state.users.find(x => x.id === userId);
    const name = u?.name || u?.user || `User #${userId}`;

    onAskConfirm(`Remove user "${name}" from system access?`, () => {
      onUpdateState(
        prev => ({
          ...prev,
          users: prev.users.filter(x => x.id !== userId)
        }),
        `User removed: ${name}`
      );
    });
  };

  const handleNameChange = (userId: number, name: string) => {
    onUpdateState(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === userId ? { ...u, name } : u))
    }));
  };

  const handleUsernameChange = (userId: number, username: string) => {
    const clean = username.trim().toLowerCase();
    const isTaken = state.users.some(u => u.id !== userId && u.user.toLowerCase() === clean && clean !== '');
    if (isTaken) {
      setMsg({ text: `Username "${clean}" is already in use.`, error: true });
      return;
    }
    setMsg(null);
    onUpdateState(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === userId ? { ...u, user: clean } : u))
    }));
  };

  const handleAllLocationsToggle = (userId: number, checked: boolean) => {
    onUpdateState(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === userId ? { ...u, all: checked } : u))
    }));
  };

  const handleLocationToggle = (userId: number, loc: string, checked: boolean) => {
    onUpdateState(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        const newLocs = checked ? [...new Set([...u.locs, loc])] : u.locs.filter(l => l !== loc);
        return { ...u, locs: newLocs };
      })
    }));
  };

  const handleAccessToggle = (userId: number, accessVal: string, checked: boolean) => {
    onUpdateState(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        let nextAcc: string[];
        if (accessVal === 'All') {
          nextAcc = checked ? ['All'] : [];
        } else {
          nextAcc = checked
            ? [...new Set([...u.acc.filter(a => a !== 'All'), accessVal])]
            : u.acc.filter(a => a !== accessVal);
        }
        return { ...u, acc: nextAcc };
      })
    }));
  };

  const handleRestrictionToggle = (userId: number, resVal: string, checked: boolean) => {
    onUpdateState(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        const nextRes = checked
          ? [...new Set([...u.res, resVal])]
          : u.res.filter(r => r !== resVal);
        return { ...u, res: nextRes };
      })
    }));
  };

  const handlePasswordReset = async (userId: number, newPw: string) => {
    if (!newPw) return;
    if (newPw.length < 6) {
      setMsg({ text: 'Password needs at least 6 characters.', error: true });
      return;
    }

    const salt = rnd();
    const hash = await sha256(salt + newPw);

    onUpdateState(
      prev => ({
        ...prev,
        users: prev.users.map(u => (u.id === userId ? { ...u, salt, hash } : u))
      }),
      `Password reset for user #${userId}`
    );
    setMsg({ text: 'Password successfully updated.', error: false });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <span>User Access & Role Permissions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure employee credentials, location privileges, and operational authorizations.
          </p>
        </div>

        {canAdmin && (
          <button
            type="button"
            onClick={handleAddUser}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add user</span>
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`p-2.5 rounded-lg text-xs font-medium ${
            msg.error
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Users Matrix Table */}
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse ledger-table font-sans">
            <thead className="bg-slate-200/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border-b border-slate-300 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-2 text-center w-12 border-r border-slate-300 dark:border-slate-700">
                  Line #
                </th>
                <th className="py-2.5 px-3 text-left w-40 border-r border-slate-300 dark:border-slate-700">
                  Employee Name
                </th>
                <th className="py-2.5 px-3 text-left min-w-[220px] border-r border-slate-300 dark:border-slate-700">
                  Location Access
                </th>
                <th className="py-2.5 px-3 text-left min-w-[200px] border-r border-slate-300 dark:border-slate-700">
                  Access
                </th>
                <th className="py-2.5 px-3 text-left min-w-[180px] border-r border-slate-300 dark:border-slate-700">
                  Restrictions
                </th>
                <th className="py-2.5 px-3 text-left w-32 border-r border-slate-300 dark:border-slate-700">
                  Username
                </th>
                <th className="py-2.5 px-3 text-left w-40 border-r border-slate-300 dark:border-slate-700">
                  Set Password
                </th>
                {canAdmin && <th className="py-2.5 px-2 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.users.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {/* Line # */}
                  <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-500 border-r border-slate-200 dark:border-slate-800">
                    {idx + 1}
                  </td>

                  {/* Employee Name */}
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      disabled={!canAdmin}
                      value={u.name}
                      onChange={e => handleNameChange(u.id, e.target.value)}
                      placeholder="Employee name"
                      className="w-full px-2 py-1 text-xs font-medium bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                    />
                  </td>

                  {/* Location Access */}
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                        <input
                          type="checkbox"
                          disabled={!canAdmin}
                          checked={u.all}
                          onChange={e => handleAllLocationsToggle(u.id, e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>All Location</span>
                      </label>

                      <div className="flex flex-wrap gap-2 pt-1 pl-4">
                        {state.locs.map(loc => (
                          <label
                            key={loc}
                            className={`flex items-center gap-1.5 text-[11px] ${
                              u.all ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!canAdmin || u.all}
                              checked={!u.all && u.locs.includes(loc)}
                              onChange={e => handleLocationToggle(u.id, loc, e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span>{loc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* Access privileges */}
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                      {ACCESS_OPTIONS.map(opt => {
                        const isAllSelected = u.acc.includes('All');
                        const isChecked = u.acc.includes(opt);
                        const isDisabled = !canAdmin || (isAllSelected && opt !== 'All');

                        return (
                          <label
                            key={opt}
                            className={`flex items-center gap-1.5 text-xs ${
                              isDisabled && opt !== 'All' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isDisabled}
                              checked={isChecked}
                              onChange={e => handleAccessToggle(u.id, opt, e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span className={opt === 'All' ? 'font-semibold text-slate-900 dark:text-slate-100' : ''}>
                              {opt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </td>

                  {/* Restrictions */}
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                      {RESTRICTION_OPTIONS.map(res => (
                        <label
                          key={res}
                          className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            disabled={!canAdmin}
                            checked={u.res.includes(res)}
                            onChange={e => handleRestrictionToggle(u.id, res, e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>{res}</span>
                        </label>
                      ))}
                    </div>
                  </td>

                  {/* Username */}
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      disabled={!canAdmin}
                      value={u.user}
                      onChange={e => handleUsernameChange(u.id, e.target.value)}
                      placeholder="Username"
                      className="w-full px-2 py-1 text-xs font-mono bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                    />
                  </td>

                  {/* Password reset input */}
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="password"
                      disabled={!canAdmin}
                      placeholder={u.hash ? '•••••••• (configured)' : 'Set password'}
                      onBlur={e => {
                        if (e.target.value) {
                          handlePasswordReset(u.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handlePasswordReset(u.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      className="w-full px-2 py-1 text-xs bg-transparent border border-transparent hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-600 rounded focus:outline-none"
                    />
                  </td>

                  {/* Remove user */}
                  {canAdmin && (
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        title="Remove user"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanatory guidelines */}
      <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
        <p>
          • <strong>Access Control:</strong> Users sign in with their unique username and password. Passwords are stored as salted SHA-256 hashes.
        </p>
        <p>
          • <strong>Administrator Privileges:</strong> Only users with All Location, All access, and zero restrictions can manage User Access, Locations, and Cashiers.
        </p>
        <p>
          • <strong>View Only:</strong> Allows browsing ledgers and summaries without editing records.
        </p>
      </div>

      {/* Change History Audit Log */}
      <ChangeHistory
        logs={state.log || []}
        currentTab="users"
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
