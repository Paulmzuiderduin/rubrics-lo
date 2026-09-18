import { useEffect, useState } from 'react';
import { BookOpenCheck, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import App from './App.jsx';
import { isSupabaseConfigured, supabase } from './supabase.js';

function ConfigurationMissing() {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpenCheck size={24} /><span>Rubrics LO</span></div><p className="eyebrow">Configuratie nodig</p><h1>Supabase is nog niet ingesteld</h1><p>Voeg de project-URL en publishable key toe aan de omgevingsvariabelen en bouw de app opnieuw.</p></section></main>;
}

function AuthForm() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next) {
    setMode(next); setPassword(''); setConfirmPassword(''); setError(''); setNotice('');
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${window.location.pathname}` });
        if (resetError) throw resetError;
        setNotice('Als dit e-mailadres bekend is, ontvang je een link om je wachtwoord te wijzigen.');
      } else if (mode === 'signup') {
        if (password.length < 12) throw new Error('Gebruik minimaal 12 tekens voor je wachtwoord.');
        if (password !== confirmPassword) throw new Error('De wachtwoorden zijn niet gelijk.');
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setNotice('Controleer je e-mail en bevestig je account. Daarna kun je inloggen.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      setError(mode === 'signin' && caught.status === 400 ? 'E-mailadres of wachtwoord is niet juist.' : (caught.message || 'Deze actie is niet gelukt.'));
    } finally { setBusy(false); }
  }

  const title = mode === 'signup' ? 'Docentenaccount maken' : mode === 'forgot' ? 'Wachtwoord herstellen' : 'Inloggen';
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpenCheck size={24} /><span>Rubrics LO</span></div><p className="eyebrow">Beveiligde docentenomgeving</p><h1>{title}</h1><p>{mode === 'forgot' ? 'Je ontvangt een beveiligde link per e-mail.' : 'Leerlinggegevens zijn alleen zichtbaar binnen jouw eigen account.'}</p><form onSubmit={submit}><label className="field"><span>E-mailadres</span><div className="auth-input"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus /></div></label>{mode !== 'forgot' && <label className="field"><span>Wachtwoord</span><div className="auth-input"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : undefined} required /></div>{mode === 'signup' && <small>Minimaal 12 tekens; gebruik bij voorkeur een wachtwoordmanager.</small>}</label>}{mode === 'signup' && <label className="field"><span>Wachtwoord herhalen</span><div className="auth-input"><KeyRound size={17} /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength="12" required /></div></label>}{error && <p className="auth-message error" role="alert">{error}</p>}{notice && <p className="auth-message success" role="status">{notice}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Even wachten…' : mode === 'signup' ? 'Account maken' : mode === 'forgot' ? 'Herstellink versturen' : 'Inloggen'}</button></form><div className="auth-links">{mode === 'signin' && <><button onClick={() => switchMode('forgot')}>Wachtwoord vergeten?</button><button onClick={() => switchMode('signup')}>Nieuw account maken</button></>}{mode !== 'signin' && <button onClick={() => switchMode('signin')}>Terug naar inloggen</button>}</div><div className="auth-security"><ShieldCheck size={18} /><span>De database gebruikt Row Level Security: ieder account kan alleen de eigen werkomgeving lezen en wijzigen.</span></div></section></main>;
}

function PasswordRecovery({ onDone }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (password.length < 12) return setError('Gebruik minimaal 12 tekens voor je wachtwoord.');
    if (password !== confirm) return setError('De wachtwoorden zijn niet gelijk.');
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    onDone();
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpenCheck size={24} /><span>Rubrics LO</span></div><p className="eyebrow">Accountbeveiliging</p><h1>Nieuw wachtwoord instellen</h1><form onSubmit={submit}><label className="field"><span>Nieuw wachtwoord</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength="12" required /></label><label className="field"><span>Wachtwoord herhalen</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength="12" required /></label>{error && <p className="auth-message error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Opslaan…' : 'Wachtwoord opslaan'}</button></form></section></main>;
}

export default function AuthRoot() {
  const present = new URLSearchParams(window.location.search).has('present');
  const [ready, setReady] = useState(false); const [user, setUser] = useState(null); const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase || present) { setReady(true); return undefined; }
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) { setUser(data.user || null); setReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setUser(session?.user || null); setReady(true);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [present]);

  if (present) return <App />;
  if (!isSupabaseConfigured) return <ConfigurationMissing />;
  if (!ready) return <main className="auth-page"><div className="auth-loading">Rubrics LO wordt veilig geladen…</div></main>;
  if (recovering) return <PasswordRecovery onDone={() => setRecovering(false)} />;
  if (!user) return <AuthForm />;
  return <App user={user} onSignOut={() => supabase.auth.signOut()} />;
}
