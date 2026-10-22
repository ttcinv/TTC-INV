import React, { useState, useEffect } from 'react';
import { AppState, User, LogEntry } from './types';
import {
  loadState,
  saveState,
  getSeedState,
  autoCarryOver,
  addDay,
  fd,
  rnd,
  today
} from './utils/helpers';
import { Header } from './components/Header';
import { TabsNav } from './components/TabsNav';
import { DataEntryTab } from './components/DataEntryTab';
import { TransferFromTab } from './components/TransferFromTab';
import { TransferToTab } from './components/TransferToTab';
import { SummaryViewTab } from './components/SummaryViewTab';
import { CashDetailsSummaryTab } from './components/CashDetailsSummaryTab';
import { ProfitAndLossTab } from './components/ProfitAndLossTab';
import { ItemMasterTab } from './components/ItemMasterTab';
import { UsersTab } from './components/UsersTab';
import { SetupTab } from './components/SetupTab';
import { LoginModal } from './components/LoginModal';
import { PasswordModal } from './components/PasswordModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ShieldAlert } from 'lucide-react';
import {
  testConnection,
  ensureAuthSession,
  saveStateToFirestore,
  subscribeToFirestoreState,
  signInWithGoogle,
  auth
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [currentTab, setCurrentTab] = useState<string>('entry');
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => {
    try {
      const stored = sessionStorage.getItem('inv_sess');
      return stored ? Number(stored) : null;
    } catch {
      return null;
    }
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('inv_theme') === 'dark' ||
        (!localStorage.getItem('inv_theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    } catch {
      return false;
    }
  });

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {}
  });

  // Apply dark mode class to <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('inv_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('inv_theme', 'light');
    }
  }, [darkMode]);

  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const isRemoteSyncRef = React.useRef(false);

  // Initialize Firebase connection and sync
  useEffect(() => {
    testConnection();
    ensureAuthSession();

    const unsubAuth = onAuthStateChanged(auth, u => {
      setFirebaseUser(u);
    });

    const unsubFirestore = subscribeToFirestoreState(
      remoteState => {
        if (remoteState && typeof remoteState === 'object') {
          isRemoteSyncRef.current = true;
          setState(remoteState);
          setCloudStatus('connected');
          setTimeout(() => {
            isRemoteSyncRef.current = false;
          }, 150);
        }
      },
      () => {
        // Document empty on Firestore, seed from local state
        const initial = loadState();
        saveStateToFirestore(initial, 'Initial Setup')
          .then(() => setCloudStatus('connected'))
          .catch(() => setCloudStatus('offline'));
      }
    );

    return () => {
      unsubAuth();
      unsubFirestore();
    };
  }, []);

  // Save state to local cache on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Current user resolution
  const currentUser: User | null =
    state.users.find(u => u.id === currentUserId && u.user) || null;

  // Permissions helpers
  const canAccessLocation = (loc: string): boolean => {
    if (!currentUser) return true;
    return currentUser.all || currentUser.locs.includes(loc);
  };

  const isUserAdmin = (u: User | null): boolean => {
    if (!u) return false;
    return u.all && u.acc.includes('All') && !u.acc.includes('View Only') && u.res.length === 0;
  };

  const hasAnyAdmin = state.users.some(isUserAdmin);
  const canAdmin = !currentUser || isUserAdmin(currentUser) || !hasAnyAdmin;

  const canEditData = (): boolean => {
    if (!currentUser) return true;
    return currentUser.acc.includes('All') && !currentUser.acc.includes('View Only');
  };

  const canChangeSetting = (settingName: string): boolean => {
    if (!currentUser) return true;
    const hasAccess = currentUser.acc.includes('All') || currentUser.acc.includes(settingName);
    const hasRestriction = currentUser.res.includes(settingName);
    return hasAccess && !hasRestriction;
  };

  const availableLocations = currentUser?.all
    ? state.locs
    : state.locs.filter(l => currentUser?.locs.includes(l));

  // Auto-carryover effect when viewing data entry
  useEffect(() => {
    if (currentTab === 'entry' && state.vd) {
      const shift = state.vf || 'AM';
      setState(prev => {
        const withCarry = autoCarryOver(prev, prev.vd || today(), shift);
        if (withCarry.length !== prev.rows.length) {
          const diff = withCarry.length - prev.rows.length;
          const logEntry: LogEntry = {
            id: rnd(),
            t: new Date().toISOString(),
            u: currentUser ? currentUser.name : '(system)',
            tab: 'entry',
            act: 'Carried over',
            desc: `${diff} item(s) carried forward to ${fd(prev.vd || '')} (${shift} Shift)`,
            date: prev.vd,
            loc: prev.inv
          };
          return {
            ...prev,
            rows: withCarry,
            log: [...prev.log, logEntry]
          };
        }
        return prev;
      });
    }
  }, [currentTab, state.vd, state.vf, state.inv]);

  // Central state updater with audit log support
  const handleUpdateState = (
    updater: (prev: AppState) => AppState,
    actionDescription?: string
  ) => {
    setState(prev => {
      const next = updater(prev);
      if (actionDescription) {
        const entry: LogEntry = {
          id: rnd(),
          t: new Date().toISOString(),
          u: currentUser ? currentUser.name : (firebaseUser?.displayName || firebaseUser?.email || '(system)'),
          tab: currentTab.startsWith('w') ? 'summary' : currentTab,
          act: actionDescription.includes('deleted')
            ? 'Deleted'
            : actionDescription.includes('added')
            ? 'Added'
            : actionDescription.includes('Imported')
            ? 'Imported'
            : 'Changed',
          desc: actionDescription,
          date: next.vd || next.start,
          loc: next.inv
        };
        next.log = [...(next.log || []), entry];
      }

      if (!isRemoteSyncRef.current) {
        setCloudStatus('syncing');
        saveStateToFirestore(next, currentUser?.name || firebaseUser?.email || undefined)
          .then(() => setCloudStatus('connected'))
          .catch(() => setCloudStatus('offline'));
      }

      return next;
    });
  };

  const handleAskConfirm = (message: string, onConfirmAction: () => void) => {
    setConfirmDialog({
      isOpen: true,
      message,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onConfirmAction();
      }
    });
  };

  const handleLoginSuccess = (userObj: User) => {
    setCurrentUserId(userObj.id);
    sessionStorage.setItem('inv_sess', String(userObj.id));

    // If active location is not in user's permitted locations, switch to first available
    if (!userObj.all && userObj.locs.length > 0 && !userObj.locs.includes(state.inv)) {
      handleUpdateState(prev => ({ ...prev, inv: userObj.locs[0] }));
    }

    handleUpdateState(
      prev => prev,
      `User signed in: ${userObj.name || userObj.user}`
    );
  };

  const handleSignOut = () => {
    const prevName = currentUser?.name || 'User';
    setCurrentUserId(null);
    sessionStorage.removeItem('inv_sess');
    handleUpdateState(prev => prev, `Signed out (${prevName})`);
  };

  // If user is not authenticated, render Login view
  if (!currentUser) {
    return (
      <LoginModal
        users={state.users}
        onLoginSuccess={handleLoginSuccess}
        onRestoreSampleData={() => {
          const seed = getSeedState();
          setState(seed);
        }}
      />
    );
  }

  // Location Access Guard
  const locationDenied =
    (currentTab === 'entry' ||
      currentTab === 'tf' ||
      currentTab === 'tt' ||
      currentTab.startsWith('w') ||
      currentTab === 'mo' ||
      currentTab === 'pnl' ||
      currentTab === 'cash') &&
    !canAccessLocation(state.inv);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <Header
        user={currentUser}
        currentLoc={state.inv}
        startDate={state.start}
        cutDate={state.cut}
        availableLocs={availableLocations}
        canChangeLoc={canChangeSetting('Inventory Location')}
        onSelectLoc={loc => {
          handleUpdateState(prev => ({ ...prev, inv: loc }), `Switched active branch to ${loc}`);
        }}
        onChangePassword={() => setIsPasswordModalOpen(true)}
        onSignOut={handleSignOut}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        cloudStatus={cloudStatus}
        firebaseEmail={firebaseUser?.email}
        onGoogleSignIn={async () => {
          try {
            await signInWithGoogle();
          } catch (e) {
            console.error('Google sign in error', e);
          }
        }}
      />

      {/* Tabs Navigation */}
      <TabsNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        startDate={state.start}
        cutDate={state.cut}
      />

      {/* Main Workspace Content Area */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-4">
        {locationDenied ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center max-w-lg mx-auto my-12 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Location Access Restricted
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your account (<strong>{currentUser.name}</strong>) does not have access permissions for{' '}
              <strong>{state.inv}</strong>.
            </p>
            {availableLocations.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Switch to an authorized branch:
                </label>
                <div className="flex flex-wrap justify-center gap-2">
                  {availableLocations.map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() =>
                        handleUpdateState(
                          prev => ({ ...prev, inv: loc }),
                          `Switched branch to ${loc}`
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {currentTab === 'entry' && (
              <DataEntryTab
                state={state}
                onUpdateState={handleUpdateState}
                canEdit={canEditData()}
                canAdmin={canAdmin}
                onAskConfirm={handleAskConfirm}
              />
            )}

            {currentTab.startsWith('w') && (() => {
              const weekNum = parseInt(currentTab.slice(1));
              const a = addDay(state.start, 7 * (weekNum - 1));
              let b = addDay(a, 6);
              if (b > state.cut) b = state.cut;

              return (
                <SummaryViewTab
                  state={state}
                  title={`Week ${weekNum} Summary`}
                  startDate={a}
                  endDate={b}
                  tabKey={currentTab}
                  canAdmin={canAdmin}
                  onUpdateState={updater => handleUpdateState(updater)}
                  onSelectTab={setCurrentTab}
                />
              );
            })()}

            {currentTab === 'mo' && (
              <SummaryViewTab
                state={state}
                title="Monthly Summary"
                startDate={state.start}
                endDate={state.cut}
                tabKey="mo"
                canAdmin={canAdmin}
                onUpdateState={updater => handleUpdateState(updater)}
                onSelectTab={setCurrentTab}
              />
            )}

            {currentTab === 'cash' && (
              <CashDetailsSummaryTab
                state={state}
                canEdit={canEditData()}
                canAdmin={canAdmin}
                onUpdateState={handleUpdateState}
              />
            )}

            {currentTab === 'pnl' && (
              <ProfitAndLossTab
                state={state}
                canAdmin={canAdmin}
              />
            )}

            {currentTab === 'tf' && (
              <TransferFromTab
                state={state}
                canEdit={canEditData()}
                canAdmin={canAdmin}
                onUpdateState={handleUpdateState}
                onNavigateToMonthlySummary={() => setCurrentTab('mo')}
              />
            )}

            {currentTab === 'tt' && (
              <TransferToTab
                state={state}
                canEdit={canEditData()}
                canAdmin={canAdmin}
                onUpdateState={handleUpdateState}
                onNavigateToMonthlySummary={() => setCurrentTab('mo')}
              />
            )}

            {currentTab === 'master' && (
              <ItemMasterTab
                state={state}
                canEdit={canEditData()}
                canAdmin={canAdmin}
                onUpdateState={handleUpdateState}
                onAskConfirm={handleAskConfirm}
              />
            )}

            {currentTab === 'users' && (
              <UsersTab
                state={state}
                canAdmin={canAdmin}
                onUpdateState={handleUpdateState}
                onAskConfirm={handleAskConfirm}
              />
            )}

            {currentTab === 'setup' && (
              <SetupTab
                state={state}
                canAdmin={canAdmin}
                canChangeLoc={canChangeSetting('Inventory Location')}
                canChangeStart={canChangeSetting('Start Date')}
                canChangeCut={canChangeSetting('Cut Off Date')}
                onUpdateState={handleUpdateState}
                onAskConfirm={handleAskConfirm}
              />
            )}
          </>
        )}
      </main>

      {/* Password Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        user={currentUser}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={updatedUser => {
          handleUpdateState(
            prev => ({
              ...prev,
              users: prev.users.map(u => (u.id === updatedUser.id ? updatedUser : u))
            }),
            `Password changed by ${currentUser.name}`
          );
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
