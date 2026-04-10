import { useState } from 'react';
import { Brain, BarChart2, Video, Film, FlaskConical, Calendar } from 'lucide-react';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import VideoQueue from './components/VideoQueue';
import ContentCalendar from './components/ContentCalendar';
import VideoList from './components/VideoList';
import ResearchInsights from './components/ResearchInsights';

const TABS = [
  { id: 'analytics', label: 'Inicio',     icon: BarChart2 },
  { id: 'queue',     label: 'Generar',    icon: Video },
  { id: 'videos',    label: 'Vídeos',     icon: Film },
  { id: 'research',  label: 'Research',   icon: FlaskConical },
  { id: 'calendar',  label: 'Calendario', icon: Calendar },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('analytics');
  const active = TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[#0a0a14]/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Brain size={16} className="text-white" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-bold">Datos Psicológicos</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{active?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Activo
          </div>
        </div>
      </header>

      {/* ── Contenido ──────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24">
        {activeTab === 'analytics' && <AnalyticsDashboard onNavigate={setActiveTab} />}
        {activeTab === 'queue'     && <VideoQueue />}
        {activeTab === 'videos'    && <VideoList />}
        {activeTab === 'research'  && <ResearchInsights />}
        {activeTab === 'calendar'  && <ContentCalendar />}
      </main>

      {/* ── Navegación inferior (mobile-first) ─────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[#0d0d1a]/95 backdrop-blur border-t border-slate-800">
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                activeTab === id ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
