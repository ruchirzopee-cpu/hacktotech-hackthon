import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, AlertTriangle, BarChart3, Check, CircleHelp, Droplets, Gauge, Leaf,
  Lightbulb, Plus, Settings, Sparkles, Trash2, Zap,
} from 'lucide-react';

type Kind = 'energy' | 'water';
type Entry = { id: string; kind: Kind; date: string; amount: number; note: string; sample?: boolean };
type SettingsData = { energyDaily: number; energyWeekly: number; waterDaily: number; waterWeekly: number; price: number };
type Props = { entries: Entry[]; setEntries: (next: Entry[] | ((old: Entry[]) => Entry[])) => void; settings: SettingsData; setSettings: (s: SettingsData) => void; storageIssue: string; setStorageIssue: (s: string) => void; onDemo: () => void; onClear: () => void; welcome: boolean; setWelcome: (v: boolean) => void };

const ENTRY_KEY = 'ecotrack.entries.v1';
const SETTINGS_KEY = 'ecotrack.settings.v1';
const DEFAULTS: SettingsData = { energyDaily: 8.5, energyWeekly: 59.5, waterDaily: 145, waterWeekly: 1015, price: 8.2 };
const nav = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/energy', label: 'Electricity', icon: Zap },
  { href: '/water', label: 'Water', icon: Droplets },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const isoDaysAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
const demoEntries = (): Entry[] => [
  [0, 'energy', 7.8, 'Evening lights & study fan'], [0, 'water', 128, 'Daily household use'],
  [1, 'energy', 9.2, 'Laundry day'], [1, 'water', 154, 'Extra washing load'],
  [2, 'energy', 6.9, 'Mostly out during the day'], [2, 'water', 139, 'Daily household use'],
  [3, 'energy', 8.1, 'Study and cooking'], [3, 'water', 142, 'Daily household use'],
  [4, 'energy', 10.4, 'Longer fan use'], [4, 'water', 171, 'Guests at home'],
  [5, 'energy', 7.2, 'Lights off early'], [5, 'water', 133, 'Daily household use'],
  [6, 'energy', 8.7, 'Daily household use'], [6, 'water', 149, 'Daily household use'],
  [7, 'energy', 8.9, 'Daily household use'], [7, 'water', 158, 'Daily household use'],
  [8, 'energy', 9.7, 'Laundry day'], [8, 'water', 164, 'Extra washing load'],
  [9, 'energy', 7.4, 'Mostly out during the day'], [9, 'water', 136, 'Daily household use'],
  [10, 'energy', 8.3, 'Study and cooking'], [10, 'water', 144, 'Daily household use'],
  [11, 'energy', 9.1, 'Daily household use'], [11, 'water', 152, 'Daily household use'],
  [12, 'energy', 8.5, 'Daily household use'], [12, 'water', 146, 'Daily household use'],
  [13, 'energy', 7.9, 'Lights off early'], [13, 'water', 140, 'Daily household use'],
  [14, 'energy', 8.8, 'Daily household use'], [14, 'water', 148, 'Daily household use'],
].map(([days, kind, amount, note], i) => ({ id: `sample-${i}`, date: isoDaysAgo(Number(days)), kind: kind as Kind, amount: Number(amount), note: String(note), sample: true }));

function readEntries(): { entries: Entry[]; issue: string; existed: boolean } {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    if (!raw) return { entries: demoEntries(), issue: '', existed: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((x) => !x || typeof x.id !== 'string' || !['energy', 'water'].includes(x.kind) || typeof x.date !== 'string' || !Number.isFinite(x.amount) || x.amount <= 0)) {
      return { entries: demoEntries(), issue: 'Saved records were malformed, so EcoTrack loaded fresh sample data. You can continue safely or reset the samples.', existed: true };
    }
    return { entries: parsed.map((x) => ({ ...x, note: typeof x.note === 'string' ? x.note : '' })), issue: '', existed: true };
  } catch {
    return { entries: demoEntries(), issue: 'Browser storage is unavailable. Changes work for this visit but may not survive a refresh.', existed: false };
  }
}
function safeSettings(): { settings: SettingsData; issue: string } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { settings: DEFAULTS, issue: '' };
    const value = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...value };
    if (Object.values(merged).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) throw new Error('invalid');
    return { settings: merged, issue: '' };
  } catch {
    return { settings: DEFAULTS, issue: 'Settings could not be read. EcoTrack is using the standard goals for this visit.' };
  }
}
const fmt = (n: number, digits = 1) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
const humanDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const kindLabel = (kind: Kind) => kind === 'energy' ? 'Electricity' : 'Water';
const unit = (kind: Kind) => kind === 'energy' ? 'kWh' : 'litres';

function sum(entries: Entry[], kind: Kind, start?: string, end?: string) {
  return entries.filter((e) => e.kind === kind && (!start || e.date >= start) && (!end || e.date <= end)).reduce((a, e) => a + e.amount, 0);
}
function dateBack(days: number) { return isoDaysAgo(days); }
function useStats(entries: Entry[], settings: SettingsData) {
  return useMemo(() => {
    const today = isoDaysAgo(0);
    const weekStart = dateBack(6);
    const weekEntries = entries.filter((e) => e.date >= weekStart && e.date <= today);
    const energyDays = new Set(weekEntries.filter((e) => e.kind === 'energy').map((e) => e.date)).size;
    const waterDays = new Set(weekEntries.filter((e) => e.kind === 'water').map((e) => e.date)).size;
    const energyAvg = energyDays ? sum(weekEntries, 'energy') / energyDays : 0;
    const waterAvg = waterDays ? sum(weekEntries, 'water') / waterDays : 0;
    const scores: number[] = [];
    if (energyDays) scores.push(Math.min(100, settings.energyDaily / energyAvg * 100));
    if (waterDays) scores.push(Math.min(100, settings.waterDaily / waterAvg * 100));
    let score: number | null = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    if (score !== null && scores.length === 1) score = Math.min(score, 60);
    if (score !== null && ((energyDays > 0 && energyDays < 3) || (waterDays > 0 && waterDays < 3))) score = Math.min(score, 74);
    const energyToday = sum(entries, 'energy', today, today);
    const waterToday = sum(entries, 'water', today, today);
    const energyWeek = sum(entries, 'energy', weekStart, today);
    const waterWeek = sum(entries, 'water', weekStart, today);
    return { today, weekStart, energyAvg, waterAvg, energyDays, waterDays, score: score === null ? null : Math.round(score), energyToday, waterToday, energyWeek, waterWeek, cost: energyWeek * settings.price };
  }, [entries, settings]);
}
function chartData(entries: Entry[], kind: Kind, range: 'daily' | 'weekly') {
  const length = range === 'daily' ? 7 : 6;
  return Array.from({ length }, (_, idx) => {
    const offset = length - 1 - idx;
    const date = isoDaysAgo(offset * (range === 'weekly' ? 7 : 1));
    const start = range === 'weekly' ? isoDaysAgo(offset * 7 + 6) : date;
    const total = entries.filter((e) => e.kind === kind && e.date >= start && e.date <= date).reduce((a, e) => a + e.amount, 0);
    return { label: range === 'weekly' ? new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }), energy: kind === 'energy' ? total : undefined, water: kind === 'water' ? total : undefined, amount: total };
  });
}
function Progress({ title, current, target, kind, period = 'today' }: { title: string; current: number; target: number; kind: Kind; period?: string }) {
  const percent = Math.min(100, target ? current / target * 100 : 0);
  return <div className="progress-block">
    <div className="progress-head"><span className="progress-title">{kind === 'energy' ? <Zap size={14} /> : <Droplets size={14} />}{title}</span><strong data-testid={`value-progress-${kind}-${period}`}>{fmt(current)} / {fmt(target)} {unit(kind)}</strong></div>
    <div className="progress-track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><div className={`progress-fill ${kind === 'water' ? 'blue' : ''}`} style={{ width: `${percent}%` }} /></div>
    <div className="progress-meta"><span>{Math.round(percent)}% of {period} target</span><span>{current > target ? `${fmt(current - target)} ${unit(kind)} over` : `${fmt(target - current)} ${unit(kind)} left`}</span></div>
  </div>;
}
function Chart({ entries, kind, view, onView, target }: { entries: Entry[]; kind: Kind; view: 'daily' | 'weekly'; onView: (v: 'daily' | 'weekly') => void; target: number }) {
  const data = useMemo(() => chartData(entries, kind, view), [entries, kind, view]);
  return <section className="card panel">
    <div className="panel-heading"><div><h2 className="panel-title">Your usage, over time</h2><p className="panel-note">A simple picture of your {kind === 'energy' ? 'electricity' : 'water'} routine</p></div>
      <div className="chart-switch" aria-label="Chart period"><button className={view === 'daily' ? 'selected' : ''} onClick={() => onView('daily')} data-testid={`chart-view-daily-${kind}`}>Daily</button><button className={view === 'weekly' ? 'selected' : ''} onClick={() => onView('weekly')} data-testid={`chart-view-weekly-${kind}`}>Weekly</button></div></div>
    <div className="chart-area" data-testid={`chart-${kind}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 5, right: 3, left: -18, bottom: 0 }}>
      <defs><linearGradient id={`fill-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={kind === 'energy' ? '#508b61' : '#579caf'} stopOpacity={0.22} /><stop offset="95%" stopColor={kind === 'energy' ? '#508b61' : '#579caf'} stopOpacity={0.01} /></linearGradient></defs>
      <CartesianGrid stroke="#edf0e9" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#89958d', fontSize: 10 }} />
      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#89958d', fontSize: 10 }} />
      <Tooltip formatter={(value) => [`${fmt(Number(value))} ${unit(kind)}`, kindLabel(kind)]} contentStyle={{ borderRadius: 10, border: '1px solid #e7ece4', fontSize: 11 }} />
      <Area type="monotone" dataKey="amount" stroke={kind === 'energy' ? '#4f8c60' : '#559daf'} strokeWidth={2.5} fill={`url(#fill-${kind})`} activeDot={{ r: 5 }} />
    </AreaChart></ResponsiveContainer></div>
    <div className="progress-meta"><span>Daily target: {fmt(target)} {unit(kind)}</span><span>{view === 'daily' ? 'Last 7 days' : 'Last 6 weeks'}</span></div>
  </section>;
}
function Sidebar({ path }: { path: string }) {
  return <>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Leaf size={20} /></span>EcoTrack</div>
      <div className="nav-caption">Your space</div>
      <nav className="nav-list">{nav.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-link ${path === href ? 'active' : ''}`} data-testid={`nav-${href === '/' ? 'overview' : href.slice(1)}`}><Icon size={17} strokeWidth={1.8} />{label}</Link>)}</nav>
      <div className="nav-caption">Good to know</div>
      <div className="sidebar-bottom"><strong>A little adds up.</strong>Small daily choices, made visible, are where better habits begin.</div>
    </aside>
    <nav className="mobile-nav" aria-label="Main navigation">{nav.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={path === href ? 'active' : ''} data-testid={`mobile-nav-${href === '/' ? 'overview' : href.slice(1)}`}><Icon size={17} /><span>{label}</span></Link>)}</nav>
  </>;
}
function Header({ path }: { path: string }) {
  const title = nav.find((n) => n.href === path)?.label ?? 'EcoTrack';
  return <header className="topbar"><span className="topbar-label">{title === 'Overview' ? 'A clearer view of everyday use' : `${title} · your resource journal`}</span><span className="topbar-right"><span><i className="status-dot" />Local-only tracking</span><span aria-hidden="true">·</span><span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span></span></header>;
}
function AppFrame({ children, path, storageIssue }: { children: ReactNode; path: string; storageIssue: string }) {
  return <div className="app-shell"><Sidebar path={path} /><div className="main-area"><Header path={path} />{storageIssue && <div className="content" style={{ paddingBottom: 0 }}><div className="data-warning" role="status" data-testid="storage-warning-global">{storageIssue}</div></div>}{children}</div></div>;
}
function Metric({ label, value, foot, icon: Icon, type, testid }: { label: string; value: string; foot: string; icon: typeof Zap; type: string; testid: string }) {
  return <div className={`card metric ${type}`} data-testid={testid}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>;
}
function activity(entries: Entry[]) { return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5); }
function ActivityList({ entries }: { entries: Entry[] }) {
  const list = activity(entries);
  return <div className="activity-list">{list.length ? list.map((item) => <div className="activity-row" key={item.id} data-testid={`activity-${item.id}`}><span className={`activity-icon ${item.kind === 'water' ? 'blue' : ''}`}>{item.kind === 'energy' ? <Zap size={16} /> : <Droplets size={16} />}</span><div className="activity-main"><div className="activity-name">{item.note || `${kindLabel(item.kind)} record`}{item.sample && <span style={{ color: '#87938b', fontWeight: 500 }}> · sample</span>}</div><div className="activity-date">{humanDate(item.date)}</div></div><span className="activity-amount">{fmt(item.amount)} {unit(item.kind)}</span></div>) : <div className="empty-state"><span className="empty-icon"><Activity size={21} /></span><strong>No entries yet</strong><p>Add your first daily reading to start seeing patterns.</p></div>}</div>;
}
function InsightsData({ entries, settings }: Pick<Props, 'entries' | 'settings'>) {
  const stats = useStats(entries, settings);
  const prevStart = dateBack(13), prevEnd = dateBack(7), currentStart = dateBack(6), today = dateBack(0);
  const currentEnergy = sum(entries, 'energy', currentStart, today), previousEnergy = sum(entries, 'energy', prevStart, prevEnd);
  const currentWater = sum(entries, 'water', currentStart, today), previousWater = sum(entries, 'water', prevStart, prevEnd);
  const energyPreviousDays = new Set(entries.filter((e) => e.kind === 'energy' && e.date >= prevStart && e.date <= prevEnd).map((e) => e.date)).size;
  const energyCurrentDays = new Set(entries.filter((e) => e.kind === 'energy' && e.date >= currentStart && e.date <= today).map((e) => e.date)).size;
  const waterPreviousDays = new Set(entries.filter((e) => e.kind === 'water' && e.date >= prevStart && e.date <= prevEnd).map((e) => e.date)).size;
  const waterCurrentDays = new Set(entries.filter((e) => e.kind === 'water' && e.date >= currentStart && e.date <= today).map((e) => e.date)).size;
  const haveEnergyCompare = energyPreviousDays >= 3 && energyCurrentDays >= 3;
  const haveWaterCompare = waterPreviousDays >= 3 && waterCurrentDays >= 3;
  const energyWarn = haveEnergyCompare && currentEnergy > previousEnergy * 1.25 && currentEnergy - previousEnergy > settings.energyWeekly * .15;
  const waterWarn = haveWaterCompare && currentWater > previousWater * 1.25 && currentWater - previousWater > settings.waterWeekly * .15;
  const energyOver = stats.energyToday > settings.energyDaily;
  const waterOver = stats.waterToday > settings.waterDaily;
  const energyWeeklyOver = stats.energyWeek > settings.energyWeekly;
  const waterWeeklyOver = stats.waterWeek > settings.waterWeekly;
  const alerts = [
    ...(energyOver ? [{ title: 'Electricity is above today’s target', reason: `You have logged ${fmt(stats.energyToday)} kWh against a ${fmt(settings.energyDaily)} kWh daily goal.`, tip: 'Try switching off unused lights and standby devices for the rest of the day.' }] : []),
    ...(waterOver ? [{ title: 'Water is above today’s target', reason: `You have logged ${fmt(stats.waterToday)} litres against a ${fmt(settings.waterDaily)} litres daily goal.`, tip: 'A shorter shower or a full-load wash can help bring use back toward your goal.' }] : []),
    ...(energyWeeklyOver ? [{ title: 'Electricity is above your weekly goal', reason: `Your last 7 days total is ${fmt(stats.energyWeek)} kWh against a ${fmt(settings.energyWeekly)} kWh weekly goal (${fmt(stats.energyWeek - settings.energyWeekly)} kWh over).`, tip: 'Review higher-use days and notes; grouping laundry and switching off unused standby devices may help lower next week’s use.' }] : []),
    ...(waterWeeklyOver ? [{ title: 'Water is above your weekly goal', reason: `Your last 7 days total is ${fmt(stats.waterWeek)} litres against a ${fmt(settings.waterWeekly)} litres weekly goal (${fmt(stats.waterWeek - settings.waterWeekly)} litres over).`, tip: 'Review higher-use days and notes; full-load washes and shorter showers may help bring next week’s use closer to goal.' }] : []),
    ...(energyWarn ? [{ title: 'Electricity use rose noticeably', reason: `The recent 7-day total is ${fmt((currentEnergy / previousEnergy - 1) * 100, 0)}% higher than the previous 7 days. This is a usage pattern, not a diagnosis.`, tip: 'Compare notes for laundry, visitors, or longer cooling and study hours.' }] : []),
    ...(waterWarn ? [{ title: 'Water use rose noticeably', reason: `The recent 7-day total is ${fmt((currentWater / previousWater - 1) * 100, 0)}% higher than the previous 7 days. This is a usage pattern, not a diagnosis.`, tip: 'Review unusually high-use days and consider practical routine changes; no leak is inferred.' }] : []),
  ];
  const tips = [];
  if (stats.energyDays && stats.energyAvg <= settings.energyDaily) tips.push(`Your average electricity use is ${fmt(settings.energyDaily - stats.energyAvg)} kWh below its daily goal. Keep the habits behind your lighter-use days going.`);
  else if (stats.energyDays) tips.push(`Your average electricity use is ${fmt(stats.energyAvg)} kWh per logged day. Try grouping laundry and switching off unused standby devices to move toward ${fmt(settings.energyDaily)} kWh.`);
  if (stats.waterDays && stats.waterAvg <= settings.waterDaily) tips.push(`Water is averaging ${fmt(stats.waterAvg)} litres per logged day, within your ${fmt(settings.waterDaily)} litres goal. That steady routine is worth keeping.`);
  else if (stats.waterDays) tips.push(`Water is averaging ${fmt(stats.waterAvg)} litres per logged day. A shorter shower or full-load wash is a practical place to start.`);
  if (!tips.length) tips.push('Add a few daily readings to get suggestions grounded in your own usage patterns.');
  return { stats, alerts, tips, energyWarn, waterWarn };
}
function WelcomeBanner({ onDemo, onClose }: { onDemo: () => void; onClose: () => void }) {
  return <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }} data-testid="welcome-banner">
    <span><strong>Welcome to EcoTrack.</strong> Explore with clearly labelled sample data, then replace it with your own readings.</span>
    <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}><button className="button button-quiet" onClick={onDemo} data-testid="button-load-demo">Load sample data</button><button className="icon-button" aria-label="Dismiss welcome" onClick={onClose} data-testid="button-dismiss-welcome"><Check size={16} /></button></span>
  </div>;
}
function Overview({ entries, settings, onDemo, onClear, welcome, setWelcome }: Props) {
  const stats = useStats(entries, settings);
  const insights = InsightsData({ entries, settings });
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Resource journal</div><h1>Good morning. Here’s your footprint.</h1><p className="subtitle">Small numbers, seen clearly, make better habits easier.</p></div><div style={{ display: 'flex', gap: 9 }}><button className="button button-quiet" onClick={onDemo} data-testid="button-load-demo-top"><Plus size={15} />Load sample data</button><button className="button button-primary" onClick={onClear} data-testid="button-reset-data"><Trash2 size={15} />Reset entries</button></div></div>
    {welcome && <WelcomeBanner onDemo={onDemo} onClose={() => setWelcome(false)} />}
    {stats.score === null && <div className="notice" data-testid="empty-welcome">Welcome. Start by adding an electricity or water reading. Sample records are ready to explore from the button above.</div>}
    <div className="grid metrics-grid">
      <Metric label="Electricity · today" value={`${fmt(stats.energyToday)} kWh`} foot={`7-day total ${fmt(stats.energyWeek)} kWh`} icon={Zap} type="energy" testid="value-energy-today" />
      <Metric label="Water · today" value={`${fmt(stats.waterToday)} litres`} foot={`7-day total ${fmt(stats.waterWeek)} litres`} icon={Droplets} type="water" testid="value-water-today" />
      <Metric label="Estimated electricity cost" value={`₹${fmt(stats.cost, 0)}`} foot={`7-day estimate · ₹${fmt(settings.price, 2)} per kWh`} icon={Activity} type="cost" testid="value-estimated-cost" />
      <Metric label="Eco Score" value={stats.score === null ? '—' : `${stats.score}`} foot={stats.score === null ? 'Available after logging use' : 'Based on recent 7-day averages'} icon={Leaf} type="score" testid="value-eco-score" />
    </div>
    <div className="grid dashboard-grid">
      <div className="grid" style={{ gap: 18 }}>
        <Chart entries={entries} kind="energy" view={view} onView={setView} target={settings.energyDaily} />
        <Chart entries={entries} kind="water" view={view} onView={setView} target={settings.waterDaily} />
        <section className="card panel"><div className="panel-heading"><div><h2 className="panel-title">At a glance</h2><p className="panel-note">Daily progress against the goals you set</p></div></div>
          <Progress title="Electricity" current={stats.energyToday} target={settings.energyDaily} kind="energy" /><Progress title="Water" current={stats.waterToday} target={settings.waterDaily} kind="water" />
          <div style={{ marginTop: 22 }}><Progress title="Electricity this week" current={stats.energyWeek} target={settings.energyWeekly} kind="energy" period="week" /><Progress title="Water this week" current={stats.waterWeek} target={settings.waterWeekly} kind="water" period="week" /></div>
        </section>
      </div>
      <div className="grid" style={{ gap: 18, alignContent: 'start' }}>
        <section className="card panel"><div className="panel-heading"><div><h2 className="panel-title">Your recent activity</h2><p className="panel-note">The latest readings on this device</p></div><Link href="/energy" className="button button-quiet" style={{ textDecoration: 'none', padding: '7px 10px', fontSize: 11 }} data-testid="link-all-records">View records</Link></div><ActivityList entries={entries} /></section>
        <section className="card panel"><div className="panel-heading"><div><h2 className="panel-title">Worth a second look</h2><p className="panel-note">Patterns, not diagnoses</p></div><AlertTriangle size={18} color="#b18845" /></div>
          {insights.alerts.length ? insights.alerts.slice(0, 4).map((a, i) => <div className="alert-card" key={a.title}><span className="alert-mark"><AlertTriangle size={15} /></span><div className="alert-text"><strong>{a.title}</strong><p>{a.reason}</p></div></div>) : <div className="alert-card"><span className="alert-mark" style={{ background: '#eaf3e9', color: '#4e8658' }}><Check size={15} /></span><div className="alert-text"><strong>No unusual usage alerts</strong><p>Alerts appear when enough records support a useful comparison.</p></div></div>}
          <div className="disclaimer">A possible high-use day is a prompt to review your manual entries—not evidence of a leak or faulty appliance.</div>
        </section>
      </div>
    </div>
    <p className="disclaimer" style={{ marginTop: 20 }} data-testid="text-disclaimer">Consumption and savings estimates are based on manually entered data. EcoTrack does not read meters or detect hardware issues.</p>
  </main>;
}
function RecordsPage({ kind, entries, setEntries, settings, onDemo, storageIssue }: Pick<Props, 'entries' | 'setEntries' | 'settings' | 'onDemo' | 'storageIssue'> & { kind: Kind }) {
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ date: isoDaysAgo(0), amount: '', note: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const stats = useStats(entries, settings);
  const records = entries.filter((e) => e.kind === kind && (!filter || e.date === filter)).sort((a, b) => b.date.localeCompare(a.date));
  const save = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.date) { setError('Choose a date for this reading.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (form.date > isoDaysAgo(0)) { setError('A record date cannot be in the future.'); return; }
    if (editId) setEntries((old) => old.map((e) => e.id === editId ? { ...e, date: form.date, amount, note: form.note, sample: false } : e));
    else setEntries((old) => [{ id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, date: form.date, amount, note: form.note }, ...old]);
    setEditId(null); setError(''); setForm({ date: isoDaysAgo(0), amount: '', note: '' });
  };
  const edit = (e: Entry) => { setEditId(e.id); setForm({ date: e.date, amount: String(e.amount), note: e.note }); setError(''); };
  const cancelEdit = () => { setEditId(null); setForm({ date: isoDaysAgo(0), amount: '', note: '' }); setError(''); };
  const confirmDelete = () => { if (deleteId) setEntries((old) => old.filter((e) => e.id !== deleteId)); setDeleteId(null); };
  const label = kind === 'energy' ? 'Electricity' : 'Water';
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Manual records</div><h1>{label} journal</h1><p className="subtitle">Record daily use and notice the routines behind it.</p></div><button className="button button-quiet" onClick={onDemo} data-testid={`button-demo-${kind}`}><Sparkles size={15} />Load sample data</button></div>
    {storageIssue && <div className="data-warning" role="status" data-testid="storage-warning">{storageIssue}</div>}
    {kind === 'energy' && <>
      <div className="energy-summary-grid">
        <Metric label="Electricity today" value={`${fmt(stats.energyToday)} kWh`} foot={`Daily goal ${fmt(settings.energyDaily)} kWh`} icon={Zap} type="energy" testid="energy-page-today-total" />
        <Metric label="Electricity · 7 days" value={`${fmt(stats.energyWeek)} kWh`} foot={`Estimated cost ₹${fmt(stats.cost, 0)} · ₹${fmt(settings.price, 2)}/kWh`} icon={Activity} type="cost" testid="energy-page-week-total" />
      </div>
      <section className="card panel energy-progress-panel" data-testid="energy-target-progress">
        <div className="panel-heading"><div><h2 className="panel-title">Electricity target progress</h2><p className="panel-note">Compare your logged use with the goals you set.</p></div></div>
        <Progress title="Today" current={stats.energyToday} target={settings.energyDaily} kind="energy" />
        <Progress title="This week" current={stats.energyWeek} target={settings.energyWeekly} kind="energy" period="week" />
      </section>
    </>}
    <div className="toolbar"><input type="date" aria-label="Filter by date" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid={`filter-date-${kind}`} /><button className="button button-quiet" onClick={() => setFilter('')} data-testid={`button-clear-filter-${kind}`}>Clear filter</button><span className="panel-note">{records.length} {records.length === 1 ? 'record' : 'records'}{filter ? ` for ${humanDate(filter)}` : ''}</span></div>
    <div className="record-layout">
      <section className="card table-card"><div className="table-wrap">{records.length ? <table><thead><tr><th>Date</th><th>Amount</th><th>Note</th><th>Type</th><th>Actions</th></tr></thead><tbody>{records.map((e) => <tr key={e.id} data-testid={`row-record-${e.id}`}><td><strong>{humanDate(e.date)}</strong></td><td>{fmt(e.amount)} {unit(kind)}</td><td>{e.note || '—'}</td><td><span className={`unit-pill ${kind === 'water' ? 'blue' : ''}`}>{e.sample ? 'Sample' : 'Manual'}</span></td><td><div style={{ display: 'flex', gap: 2 }}><button className="icon-button" onClick={() => edit(e)} aria-label={`Edit ${humanDate(e.date)} record`} data-testid={`button-edit-${e.id}`}><Settings size={15} /></button><button className="icon-button" onClick={() => setDeleteId(e.id)} aria-label={`Delete ${humanDate(e.date)} record`} data-testid={`button-delete-${e.id}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table> : <div className="empty-state"><span className="empty-icon">{kind === 'energy' ? <Zap size={21} /> : <Droplets size={21} />}</span><strong>{filter ? 'No readings on this date' : `No ${label.toLowerCase()} records yet`}</strong><p>{filter ? 'Try clearing the date filter or choosing another day.' : 'Add a manual reading or load sample data to explore the tracker.'}</p>{filter ? <button className="button button-quiet" onClick={() => setFilter('')} data-testid="button-empty-clear-filter">Clear date filter</button> : <button className="button button-quiet" onClick={onDemo} data-testid="button-empty-demo">Load sample data</button>}</div>}</div></section>
      <form className="card form-card" onSubmit={save} noValidate><h2>{editId ? 'Edit reading' : 'Add a reading'}</h2><p>{editId ? 'Update the date, amount, or context.' : `Add your ${kind === 'energy' ? 'electricity' : 'water'} use for a day.`}</p>
        <div className="field"><label htmlFor={`date-${kind}`}>Date</label><input id={`date-${kind}`} type="date" max={isoDaysAgo(0)} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid={`input-date-${kind}`} /></div>
        <div className="field"><label htmlFor={`amount-${kind}`}>Amount ({unit(kind)})</label><input id={`amount-${kind}`} inputMode="decimal" type="number" min="0.01" step="any" placeholder={kind === 'energy' ? 'e.g. 7.6' : 'e.g. 142'} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid={`input-amount-${kind}`} /></div>
        <div className="field"><label htmlFor={`note-${kind}`}>Note <span style={{ fontWeight: 400, color: '#89938c' }}>· optional</span></label><textarea id={`note-${kind}`} maxLength={120} placeholder="What was different about this day?" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid={`input-note-${kind}`} /></div>
        {error && <div className="form-error" role="alert" data-testid={`error-form-${kind}`}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}><button type="submit" className="button button-primary" style={{ flex: 1 }} data-testid={`button-save-${kind}`}>{editId ? 'Save changes' : <><Plus size={15} />Add reading</>}</button>{editId && <button type="button" className="button button-quiet" onClick={cancelEdit} data-testid={`button-cancel-edit-${kind}`}>Cancel</button>}</div>
        <p className="disclaimer" style={{ margin: '15px 0 0' }}>Only manually entered information is used. This is not a meter reading.</p>
      </form>
    </div>
    {deleteId && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete this reading?</h2><p>This record will be removed from this device. This action cannot be undone.</p><div className="modal-actions"><button className="button button-quiet" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">Keep record</button><button className="button button-danger" onClick={confirmDelete} data-testid="button-confirm-delete">Delete reading</button></div></div></div>}
  </main>;
}
function InsightsPage({ entries, settings }: Pick<Props, 'entries' | 'settings'>) {
  const { stats, alerts, tips, energyWarn, waterWarn } = InsightsData({ entries, settings });
  return <main className="content"><div className="page-heading"><div><div className="eyebrow">Patterns & perspective</div><h1>Insights for better habits.</h1><p className="subtitle">Useful context from the readings you chose to record.</p></div></div>
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.35fr) minmax(290px,.8fr)' }}>
      <div className="grid" style={{ alignContent: 'start', gap: 17 }}>
        <section className="card panel"><div className="panel-heading"><div><h2 className="panel-title">Heads-up, not a diagnosis</h2><p className="panel-note">An alert appears only when records support a comparison.</p></div><AlertTriangle size={18} color="#b18845" /></div>
          {alerts.length ? alerts.map((a) => <div className="alert-card" key={a.title}><span className="alert-mark"><AlertTriangle size={15} /></span><div className="alert-text"><strong>{a.title}</strong><p>{a.reason}</p><p style={{ marginTop: 7 }}><strong>Try:</strong> {a.tip}</p></div></div>) : <div className="empty-state"><span className="empty-icon"><Check size={21} /></span><strong>No alerts right now</strong><p>{entries.length < 6 ? 'Keep adding readings. A useful increase comparison needs at least six logged days per resource across the two periods.' : 'Your recent totals are not substantially above the configured targets or prior period.'}</p></div>}
          {(energyWarn || waterWarn) && <div className="disclaimer">A rise in manually entered use can have many ordinary explanations. EcoTrack does not detect a leak, appliance fault, or any hardware condition.</div>}
        </section>
        <section className="card panel"><div className="panel-heading"><div><h2 className="panel-title">Suggestions that fit your records</h2><p className="panel-note">Practical ideas, grounded in your goals and recent averages</p></div><Lightbulb size={19} color="#5f8b67" /></div>
          {tips.map((tip, i) => <div className="alert-card tip-card" key={i}><span className="alert-mark"><Sparkles size={15} /></span><div className="alert-text"><strong>{i === 0 ? 'Keep building on what works' : 'A small next step'}</strong><p>{tip}</p></div></div>)}
        </section>
      </div>
      <div className="grid" style={{ alignContent: 'start', gap: 17 }}>
        <section className="score-feature"><div className="score-top"><div><div className="score-label">YOUR ECO SCORE</div><div className="score-num" data-testid="insights-eco-score">{stats.score === null ? '—' : stats.score}</div></div><span className="metric-icon"><Leaf size={20} /></span></div><p className="score-explainer">Measures average daily use against your goals over the recent 7 days. Lower use relative to a target means a higher resource score.</p></section>
        <section className="card settings-section"><h2>How the score works</h2><p>For each resource with recent records: min(100, daily target ÷ average daily use × 100). When both are available, their scores are averaged equally.</p><p>If only one resource has records, its score is capped at 60. If a resource has fewer than 3 logged days, the overall score is capped at 74. No readings means the score is unavailable.</p><div className="notice" style={{ marginBottom: 0 }}>A high score rewards use at or below your configured targets; it is a reflection of your own goals, not a comparison with other households.</div></section>
        <section className="card settings-section"><h2>Recent 7-day averages</h2><p>Calculated from days with a record for that resource.</p><Progress title="Electricity" current={stats.energyAvg} target={settings.energyDaily} kind="energy" period="average" /><Progress title="Water" current={stats.waterAvg} target={settings.waterDaily} kind="water" period="average" /></section>
        <div className="disclaimer" data-testid="insights-disclaimer">Consumption and savings estimates are based on manually entered data. Suggestions are general habit ideas, not guarantees of savings.</div>
      </div>
    </div>
  </main>;
}
function SettingsPage({ settings, setSettings, onDemo, onClear }: Pick<Props, 'settings' | 'setSettings' | 'onDemo' | 'onClear'>) {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState('');
  useEffect(() => setDraft(settings), [settings]);
  const update = (key: keyof SettingsData, value: string) => setDraft({ ...draft, [key]: Number(value) });
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(draft).some((v) => !Number.isFinite(v) || v <= 0)) { setMessage('All goals and the price must be greater than zero.'); return; }
    setSettings(draft); setMessage('Your goals are saved on this device.');
  };
  const rows: { key: keyof SettingsData; label: string; unit: string; step: string }[] = [
    { key: 'energyDaily', label: 'Daily electricity goal', unit: 'kWh', step: '.1' },
    { key: 'energyWeekly', label: 'Weekly electricity goal', unit: 'kWh', step: '.1' },
    { key: 'waterDaily', label: 'Daily water goal', unit: 'litres', step: '1' },
    { key: 'waterWeekly', label: 'Weekly water goal', unit: 'litres', step: '1' },
    { key: 'price', label: 'Estimated price per kWh', unit: '₹ / kWh', step: '.01' },
  ];
  return <main className="content"><div className="page-heading"><div><div className="eyebrow">Make it yours</div><h1>Goals & preferences.</h1><p className="subtitle">Set realistic targets for the people and place you track.</p></div></div>
    <form className="card settings-section" onSubmit={save} style={{ maxWidth: 760 }}>
      <h2>Your resource goals</h2><p>Goals shape your progress bars, alerts, and Eco Score. They are yours to adjust as routines change.</p>
      {rows.map(({ key, label, unit: suffix, step }) => <div className="settings-field-row" key={key}><label htmlFor={`setting-${key}`}>{label}</label><div style={{ position: 'relative' }}><input id={`setting-${key}`} type="number" min="0" step={step} value={draft[key]} onChange={(e) => update(key, e.target.value)} data-testid={`input-setting-${key}`} /><span style={{ position: 'absolute', right: 10, top: 10, color: '#89938c', fontSize: 10, pointerEvents: 'none' }}>{suffix}</span></div></div>)}
      {message && <p role="status" style={{ color: message.startsWith('All') ? '#a74336' : '#4a7954', margin: '15px 0 0' }} data-testid="settings-status">{message}</p>}
      <div className="settings-section-actions"><button className="button button-primary" type="submit" data-testid="button-save-settings"><Check size={15} />Save goals</button></div>
    </form>
    <div style={{ maxWidth: 760 }}><div className="notice"><strong>About the estimates.</strong> Electricity cost is calculated as recorded kWh × your estimated price per kWh. Actual bills may differ due to tariffs, taxes, and billing periods.</div><p className="disclaimer">Your entries and preferences are stored locally in this browser. They are not uploaded to a server.</p>
      <section className="card settings-section" style={{ marginTop: 20 }}><h2>Explore or start fresh</h2><p>Sample data is labelled throughout. Loading it replaces current entries; it will not change your goals.</p><div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}><button className="button button-quiet" onClick={onDemo} data-testid="button-settings-demo"><Sparkles size={15} />Load sample data</button><button className="button button-danger" onClick={onClear} data-testid="button-settings-reset"><Trash2 size={15} />Clear all records</button></div></section></div>
  </main>;
}
function NotFound() { return <main className="content"><div className="empty-state"><span className="empty-icon"><CircleHelp size={21} /></span><strong>That page isn't in the journal</strong><p>Choose a section from the navigation to find your way back.</p><Link href="/" className="button button-primary" data-testid="link-not-found-home">Back to overview</Link></div></main>; }
function App() {
  const [path] = useLocation();
  const initial = useMemo(readEntries, []);
  const settingRead = useMemo(safeSettings, []);
  const [entries, setEntries] = useState<Entry[]>(initial.entries);
  const [settings, setSettings] = useState<SettingsData>(settingRead.settings);
  const [storageIssue, setStorageIssue] = useState(initial.issue || settingRead.issue);
  const [welcome, setWelcome] = useState(!initial.existed);
  useEffect(() => {
    try { localStorage.setItem(ENTRY_KEY, JSON.stringify(entries)); if (storageIssue.includes('unavailable')) setStorageIssue(''); }
    catch { setStorageIssue('Browser storage is unavailable. Your current changes remain in memory but may not survive a refresh.'); }
  }, [entries]);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { setStorageIssue('Browser storage is unavailable. Your current changes remain in memory but may not survive a refresh.'); }
  }, [settings]);
  const onDemo = () => {
    const hasManualEntries = entries.some((entry) => !entry.sample);
    if (hasManualEntries && !window.confirm('Loading sample data will replace all current readings on this device. Continue?')) return;
    setEntries(demoEntries());
    setWelcome(false);
  };
  const onClear = () => { if (window.confirm('Clear all records on this device? Your goals will be kept.')) { setEntries([]); setWelcome(false); } };
  const props: Props = { entries, setEntries, settings, setSettings, storageIssue, setStorageIssue, onDemo, onClear, welcome, setWelcome };
  return <AppFrame path={path} storageIssue={storageIssue}><Switch>
    <Route path="/" component={() => <Overview {...props} />} />
    <Route path="/energy" component={() => <RecordsPage kind="energy" {...props} />} />
    <Route path="/water" component={() => <RecordsPage kind="water" {...props} />} />
    <Route path="/insights" component={() => <InsightsPage {...props} />} />
    <Route path="/settings" component={() => <SettingsPage {...props} />} />
    <Route component={NotFound} />
  </Switch></AppFrame>;
}
export default App;
