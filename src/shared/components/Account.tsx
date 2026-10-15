import { useEffect, useReducer, useRef, useState } from 'react';
import { cloudEnabled, getSyncState, getUser, onCloudChange, pull, signIn, signOut, signUp } from '../cloud';

/** Header chip showing sync status; opens sign-in or account options. Hidden if sync isn't configured. */
export function Account() {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState(false);
  useEffect(() => onCloudChange(rerender), []);

  if (!cloudEnabled) return null;
  const user = getUser();
  const state = getSyncState();
  const label = !user ? 'Sign in to sync' : state === 'syncing' ? 'Syncing…' : state === 'error' ? 'Sync issue' : 'Synced';

  return (
    <>
      <button type="button" className={`account-chip account-chip--${user ? state : 'signed-out'}`} onClick={() => setOpen(true)}>
        <span aria-hidden="true">{state === 'error' && user ? '⚠' : '☁'}</span> {label}
      </button>
      <AccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const user = getUser();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setMessage(null);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // After signing in/out or syncing, reload so every part of the page reads the fresh data.
  const run = async (action: () => Promise<boolean | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      if ((await action()) !== false) location.reload();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong', error: true });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'in') {
        await signIn(email.trim(), password);
        await pull();
        return;
      }
      const needsConfirm = await signUp(email.trim(), password);
      if (needsConfirm) {
        setMessage({ text: 'Check your email to confirm the account, then sign in here.' });
        setMode('in');
        return false;
      }
      await pull();
    });
  };

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()} aria-labelledby="account-title">
      {user ? (
        <div className="dialog__form">
          <h2 id="account-title">Synced account</h2>
          <p className="muted account-email">{user.email}</p>
          <p className="muted">Progress, stats, links, and settings sync to every device signed in to this account.</p>
          {message && <p className={message.error ? 'dialog__error' : 'dialog__note'}>{message.text}</p>}
          <div className="dialog__actions">
            <button type="button" className="button button--ghost" disabled={busy} onClick={() => run(signOut)}>
              Sign out
            </button>
            <span className="dialog__spacer" />
            <button type="button" className="button button--ghost" onClick={onClose}>
              Close
            </button>
            <button type="button" className="button" disabled={busy} onClick={() => run(pull)}>
              {busy ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>
      ) : (
        <form className="dialog__form" onSubmit={submit}>
          <h2 id="account-title">{mode === 'in' ? 'Sign in to sync' : 'Create your account'}</h2>
          <p className="muted">One shared account for the two of you: sign in on each device to keep progress, stats, and links in sync.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {message && <p className={message.error ? 'dialog__error' : 'dialog__note'}>{message.text}</p>}
          <div className="dialog__actions">
            <button type="button" className="link-button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'Create an account' : 'I already have one'}
            </button>
            <span className="dialog__spacer" />
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={busy}>
              {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
