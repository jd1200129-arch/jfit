import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { clearSession, readSession, storeSession } from './src/secure-session';

type Tab = 'Today' | 'Explore' | 'Plan' | 'Progress' | 'Profile';
const tabs: Tab[] = ['Today', 'Explore', 'Plan', 'Progress', 'Profile'];
const copy: Record<Tab, { kicker: string; title: string; body: string; cards: string[] }> = {
  Today: { kicker: 'YOUR SPACE TO MOVE', title: 'A little is still a lot.', body: 'Your Jfit day starts wherever you are. Pick a session that feels good.', cards: ['Find a workout', 'Continue a programme'] },
  Explore: { kicker: 'THE JFIT LIBRARY', title: 'Find your kind of movement.', body: 'The catalogue is waiting for Jfit content to be published.', cards: ['Strength', 'Yoga & Pilates', 'Cardio & HIIT'] },
  Plan: { kicker: 'MAKE IT YOURS', title: 'Your week, your way.', body: 'Plan your sessions and reminders when your account is connected.', cards: ['This week', 'Programmes'] },
  Progress: { kicker: 'SMALL STEPS COUNT', title: 'Notice how far you go.', body: 'Your progress will appear after you complete your first session.', cards: ['Workout history', 'Milestones'] },
  Profile: { kicker: 'YOUR JFIT ACCOUNT', title: 'Made for you.', body: 'Sign in to keep your training and progress connected across devices.', cards: [] },
};

export default function App() {
  const [tab, setTab] = useState<Tab>('Today');
  const active = copy[tab];
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f5ef' }}>
    <StatusBar barStyle="dark-content" />
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 38, paddingBottom: 36 }}>
      <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: -3, color: '#161912' }}>jfit<Text style={{ color: '#99bc3b' }}>•</Text></Text>
      <Text style={{ marginTop: 42, color: '#777a6f', fontSize: 10, letterSpacing: 2, fontWeight: '700' }}>{active.kicker}</Text>
      <Text style={{ marginTop: 18, color: '#161912', fontSize: 42, lineHeight: 46, letterSpacing: -2, fontWeight: '700' }}>{active.title}</Text>
      <Text style={{ marginTop: 15, color: '#74766c', fontSize: 15, lineHeight: 24 }}>{active.body}</Text>
      {tab === 'Profile' ? <ProfileAccount /> : <>
        <View style={{ height: 265, backgroundColor: '#d7ddc2', marginTop: 29, padding: 22, justifyContent: 'flex-end' }}>
          <Text style={{ color: '#3e4831', fontWeight: '700', letterSpacing: 1 }}>YOUR PACE. YOUR PLACE.</Text>
          <Text style={{ marginTop: 8, fontSize: 27, fontWeight: '700', color: '#161912' }}>Move in your own way.</Text>
        </View>
        <Text style={{ marginTop: 32, fontSize: 21, fontWeight: '700', color: '#161912' }}>A good place to begin</Text>
        {active.cards.map((card) => <TouchableOpacity key={card} accessibilityRole="button" onPress={() => setTab(tab === 'Today' ? 'Explore' : tab)} style={{ backgroundColor: 'white', marginTop: 12, padding: 19, minHeight: 70, justifyContent: 'center' }}><Text style={{ fontWeight: '600', color: '#20231b' }}>{card}</Text></TouchableOpacity>)}
      </>}
      <Text style={{ color: '#86887e', fontSize: 11, marginTop: 28 }}>Your Jfit account and workout data stay private to you.</Text>
    </ScrollView>
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopColor: '#e2e2da', borderTopWidth: 1, paddingVertical: 9, paddingBottom: 12 }}>
      {tabs.map((item) => <TouchableOpacity key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={{ flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 10, fontWeight: tab === item ? '700' : '500', color: tab === item ? '#161912' : '#8b8d84' }}>{item}</Text><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: tab === item ? '#a4ce3d' : 'transparent', marginTop: 4 }} /></TouchableOpacity>)}
    </View>
  </SafeAreaView>;
}

const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
function ProfileAccount() {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [accountName, setAccountName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const token = await readSession();
      if (!token) return;
      const response = await fetch(`${apiBase}/v1/me`, { headers: { Authorization: `Bearer ${token}`, 'X-Jfit-Client': 'native' } });
      const result = await response.json();
      if (response.ok) { setSignedIn(true); setAccountName(result.user.display_name); }
      else await clearSession();
    } catch { setFeedback('Your secure session could not be read. Sign in again when you are online.'); }
  })(); }, []);

  async function submit() {
    setBusy(true); setFeedback('');
    try {
      const route = mode === 'login' ? '/v1/auth/login' : mode === 'register' ? '/v1/auth/register' : '/v1/auth/recover';
      const payload = mode === 'login' ? { email, password, deviceLabel: 'Jfit mobile' } : mode === 'register' ? { email, password, displayName: name, birthDate } : { email };
      const response = await fetch(`${apiBase}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jfit-Client': 'native' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? 'We could not complete that request.');
      if (mode === 'login') { await storeSession(result.accessToken); setSignedIn(true); setAccountName(email); setFeedback('Signed in. Your credential is stored securely on this device.'); }
      else setFeedback(result.message);
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'The account service is unavailable.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    const token = await readSession();
    try { if (token) await fetch(`${apiBase}/v1/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Jfit-Client': 'native' } }); }
    finally { await clearSession(); setSignedIn(false); setAccountName(''); setFeedback('You are signed out.'); }
  }

  const inputStyle = { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e2da', padding: 14, marginTop: 12, color: '#161912' } as const;
  if (signedIn) return <View style={{ marginTop: 25, backgroundColor: '#fff', padding: 20 }}>
    <Text style={{ fontSize: 12, color: '#74766c' }}>SIGNED IN</Text><Text style={{ fontSize: 20, fontWeight: '700', marginTop: 8, color: '#161912' }}>{accountName || email}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => void logout()} style={{ backgroundColor: '#161912', padding: 16, marginTop: 18, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '700' }}>Sign out</Text></TouchableOpacity>
    <Text style={{ color: '#74766c', fontSize: 12, marginTop: 16 }}>{feedback}</Text>
  </View>;
  return <View style={{ marginTop: 25 }}>
    {mode === 'register' && <><TextInput accessibilityLabel="Your name" autoComplete="name" placeholder="Your name" maxLength={80} value={name} onChangeText={setName} style={inputStyle} /><TextInput accessibilityLabel="Date of birth, YYYY-MM-DD" placeholder="Date of birth (YYYY-MM-DD)" maxLength={10} value={birthDate} onChangeText={setBirthDate} style={inputStyle} /></>}
    <TextInput accessibilityLabel="Email address" autoComplete="email" keyboardType="email-address" autoCapitalize="none" maxLength={254} placeholder="Email address" value={email} onChangeText={setEmail} style={inputStyle} />
    {mode !== 'recover' && <TextInput accessibilityLabel="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} secureTextEntry maxLength={128} placeholder="Password (12 characters minimum)" value={password} onChangeText={setPassword} style={inputStyle} />}
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={{ backgroundColor: '#161912', padding: 17, marginTop: 18, alignItems: 'center', opacity: busy ? 0.6 : 1 }}><Text style={{ color: 'white', fontWeight: '700' }}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send recovery instructions'}</Text></TouchableOpacity>
    <View style={{ flexDirection: 'row', gap: 18, marginTop: 18 }}><TouchableOpacity accessibilityRole="button" onPress={() => { setMode('login'); setFeedback(''); }}><Text style={{ color: '#4d543e', textDecorationLine: 'underline' }}>Sign in</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => { setMode('register'); setFeedback(''); }}><Text style={{ color: '#4d543e', textDecorationLine: 'underline' }}>Create account</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => { setMode('recover'); setFeedback(''); }}><Text style={{ color: '#4d543e', textDecorationLine: 'underline' }}>Recover</Text></TouchableOpacity></View>
    <Text accessibilityLiveRegion="polite" style={{ color: '#6b704f', fontSize: 12, lineHeight: 18, marginTop: 16 }}>{feedback || 'Email verification and recovery require Jfit email delivery to be configured.'}</Text>
  </View>;
}
