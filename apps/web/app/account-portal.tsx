'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Mode = 'login' | 'register' | 'recover' | 'resend' | 'verify' | 'reset';
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? (process.env.VERCEL ? '/api' : 'http://localhost:4000');


export default function AccountPortal({ initialMode = 'login' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; device_label: string | null; created_at: string; current: boolean }>>([]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.hash.slice(1));
    setToken(search.get('token') ?? '');
    if (initialMode === 'login' && search.has('token')) setMode('verify');
    if (search.has('token')) window.history.replaceState(null, '', window.location.pathname);
    if (!search.has('token') && initialMode !== 'verify' && initialMode !== 'reset') void refreshAccount();
  }, [initialMode]);

  async function refreshAccount() {
    try {
      const [meResponse, sessionResponse] = await Promise.all([
        fetch(`${apiBase}/v1/me`, { credentials: 'include' }), fetch(`${apiBase}/v1/sessions`, { credentials: 'include' }),
      ]);
      if (!meResponse.ok) return;
      const me = await meResponse.json();
      const sessionData = sessionResponse.ok ? await sessionResponse.json() : { items: [] };
      setProfile(me.user); setSessions(sessionData.items ?? []); setSignedIn(true);
    } catch { /* The sign-in form remains usable if the API is offline. */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint: Record<Mode, string> = { login: '/v1/auth/login', register: '/v1/auth/register', recover: '/v1/auth/recover', resend: '/v1/auth/resend-verification', verify: '/v1/auth/verify-email', reset: '/v1/auth/reset-password' };
    const payload = mode === 'verify' ? { token } : mode === 'reset' ? { ...values, token } : values;
    try {
      const response = await fetch(`${apiBase}${endpoint[mode]}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? 'We could not complete that request.');
      if (mode === 'login') { setMessage('You are signed in. Your session is stored in a secure, HTTP-only cookie.'); await refreshAccount(); }
      else if (mode === 'register') setMessage(result.message);
      else if (mode === 'recover' || mode === 'resend') setMessage(result.message);
      else if (mode === 'verify') { setMessage('Your email is verified. You can now sign in.'); setMode('login'); }
      else if (mode === 'reset') { setMessage('Your password has been changed and your other sessions have been signed out.'); setMode('login'); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The account service is unavailable.');
    } finally { setBusy(false); }
  }

  if (signedIn && profile) return <main className="account-page">
    <header className="nav wrap"><Link className="brand" href="/">jfit<span>•</span></Link><Link className="text-link" href="/">Home <span>↗</span></Link></header>
    <section className="account-card wrap"><div className="eyebrow"><i /> YOUR JFIT ACCOUNT</div><h1>Good to see you.</h1><p className="account-intro">Signed in as {profile.display_name || profile.email}.</p><h2 className="sessions-title">Active devices</h2>
      {sessions.map((item) => <div className="session-row" key={item.id}><span>{item.device_label || 'Browser session'}{item.current ? ' · this device' : ''}</span><button type="button" onClick={async () => { await fetch(`${apiBase}/v1/sessions/${item.id}`, { method: 'DELETE', credentials: 'include' }); if (item.current) { setSignedIn(false); setProfile(null); setSessions([]); } else await refreshAccount(); }}>Sign out</button></div>)}
      <button className="button account-submit" type="button" onClick={async () => { await fetch(`${apiBase}/v1/auth/logout-all`, { method: 'POST', credentials: 'include' }); setSignedIn(false); setProfile(null); setSessions([]); }}>Sign out all devices <span>↗</span></button>
    </section>
  </main>;

  return <main className="account-page">
    <header className="nav wrap"><Link className="brand" href="/">jfit<span>•</span></Link><Link className="text-link" href="/">Back home <span>↗</span></Link></header>
    <section className="account-card wrap">
      <div className="eyebrow"><i /> YOUR JFIT ACCOUNT</div>
      <h1>{mode === 'register' ? 'Start with you.' : mode === 'recover' ? 'Let’s get you back in.' : mode === 'verify' ? 'Verify your email.' : mode === 'reset' ? 'Choose a new password.' : 'Good to see you.'}</h1>
      <p className="account-intro">One account for your training, progress and Jfit orders.</p>
      {!signedIn && <div className="account-tabs" role="tablist" aria-label="Account action">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMessage(''); setError(''); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMessage(''); setError(''); }}>Create account</button>
      </div>}
      {!signedIn && <form onSubmit={submit}>
        {(mode === 'register') && <label>Your name<input name="displayName" autoComplete="name" maxLength={80} required /></label>}
        {(mode === 'login' || mode === 'register' || mode === 'recover' || mode === 'resend') && <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
        {(mode === 'register') && <label>Date of birth<input name="birthDate" type="date" autoComplete="bday" required /><small>Jfit accounts are currently for adults aged 18 and over.</small></label>}
        {(mode === 'login' || mode === 'register' || mode === 'reset') && <label>{mode === 'reset' ? 'New password' : 'Password'}<input name="password" type="password" minLength={12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><small>Use at least 12 characters.</small></label>}
        {mode === 'verify' && <div className="account-notice">This verifies the email address you registered with. The one-time link expires after 24 hours.</div>}
        {mode === 'reset' && <div className="account-notice">Password reset links are single-use and expire after one hour.</div>}
        {mode === 'resend' && <div className="account-notice">If the address has an unverified account, we'll send another verification link.</div>}
        <button className="button account-submit" type="submit" disabled={busy || ((mode === 'verify' || mode === 'reset') && !token)}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'recover' ? 'Send recovery instructions' : mode === 'resend' ? 'Resend verification' : mode === 'verify' ? 'Verify email' : 'Change password'} <span>↗</span></button>
      </form>}
      <div aria-live="polite" className={error ? 'account-feedback account-error' : 'account-feedback'}>{error || message}</div>
      {!signedIn && mode === 'login' && <button className="account-inline" type="button" onClick={() => { setMode('recover'); setMessage(''); setError(''); }}>Forgot password?</button>}
      {!signedIn && mode === 'recover' && <button className="account-inline" type="button" onClick={() => { setMode('login'); setMessage(''); setError(''); }}>Return to sign in</button>}
      {!signedIn && mode === 'verify' && !token && <button className="account-inline" type="button" onClick={() => setMode('resend')}>Request another verification email</button>}
      {!signedIn && mode === 'login' && <button className="account-inline" type="button" onClick={() => { setMode('resend'); setMessage(''); setError(''); }}>Resend verification</button>}
      <div className="account-provider-note">Email delivery must be connected by Jfit before verification and recovery messages can arrive. Registration requests remain generic to protect account privacy.</div>
    </section>
  </main>;
}
