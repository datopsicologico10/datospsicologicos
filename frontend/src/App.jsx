import { useState } from 'react';
import { Brain, BarChart2, Video, Calendar } from 'lucide-react';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import VideoQueue from './components/VideoQueue';
import ContentCalendar from './components/ContentCalendar';

const TABS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'queue', label: 'Cola de videos', icon: Video },
  { id: 'calendar', label: 'Calendario', icon: Calendar },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('analytics');

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Psychology Shorts</p>
              <p className="text-xs text-slate-400 leading-none mt-0.5">Automation Dashboard</p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Sistema activo
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <nav className="flex gap-1 bg-slate-800/40 rounded-xl p-1 mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${
                activeTab === id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="pb-12">
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'queue' && <VideoQueue />}
          {activeTab === 'calendar' && <ContentCalendar />}
        </main>
      </div>
    </div>
  );
}
