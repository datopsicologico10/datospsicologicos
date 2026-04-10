import { useState } from 'react';
import { format, addDays, isSameDay, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, TrendingUp, Calendar } from 'lucide-react';

const PUBLISH_TIMES = ['15:00', '18:00', '21:00'];
const PRIORITY_DAYS = [3, 4, 5]; // mié, jue, vie

function isPast(date, time) {
  const [h, m] = time.split(':');
  const d = new Date(date);
  d.setHours(parseInt(h), parseInt(m), 0, 0);
  return d < new Date();
}

export default function ContentCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const weekStart = addDays(
    (() => { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return startOfDay(d); })(),
    weekOffset * 7
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // Próximos slots del calendario lineal (próximos 5 días)
  const upcoming = [];
  for (let d = 0; d < 7 && upcoming.length < 6; d++) {
    const day = addDays(today, d);
    for (const time of PUBLISH_TIMES) {
      if (!isPast(day, time)) {
        upcoming.push({ day, time });
        if (upcoming.length >= 6) break;
      }
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Próximas publicaciones ──────────────────────────── */}
      <div>
        <p className="text-base font-bold mb-3">Próximas publicaciones</p>
        <div className="space-y-2">
          {upcoming.map(({ day, time }, i) => {
            const isToday2  = isSameDay(day, today);
            const isPrio    = PRIORITY_DAYS.includes(day.getDay());
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isToday2 ? 'border-indigo-500/40 bg-indigo-900/20' :
                  isPrio   ? 'border-yellow-600/30 bg-yellow-900/10' :
                             'border-slate-700 bg-slate-800/40'
                }`}
              >
                <div className={`shrink-0 text-center w-10 ${isToday2 ? 'text-indigo-300' : 'text-slate-300'}`}>
                  <p className="text-[10px] font-medium uppercase leading-none text-slate-400">
                    {isToday2 ? 'Hoy' : format(day, 'EEE', { locale: es })}
                  </p>
                  <p className="text-lg font-black leading-tight">{format(day, 'd')}</p>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    <p className="text-sm font-bold">{time} CET</p>
                    {isPrio && (
                      <span className="text-[10px] bg-yellow-900/50 text-yellow-400 border border-yellow-700/40 px-1.5 py-0.5 rounded-full ml-1 flex items-center gap-1">
                        <TrendingUp size={8} />
                        Prioritario
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {format(day, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>

                <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400/70 animate-pulse" />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Semana ─────────────────────────────────────────── */}
      <div>
        {/* Nav semana */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-300">
            {format(weekStart, "d MMM", { locale: es })} —{' '}
            {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700 active:scale-90 text-slate-400 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 h-8 rounded-lg text-xs hover:bg-slate-700 active:scale-90 text-slate-400 transition-all"
            >
              Hoy
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700 active:scale-90 text-slate-400 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Grid compacto */}
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, i) => {
            const isToday2  = isSameDay(day, today);
            const isPast2   = isBefore(startOfDay(day), startOfDay(today));
            const isPrio    = PRIORITY_DAYS.includes(day.getDay());
            const slots     = PUBLISH_TIMES.length;

            return (
              <div
                key={i}
                className={`rounded-xl border p-2 text-center transition-all ${
                  isToday2  ? 'border-indigo-500 bg-indigo-900/25' :
                  isPast2   ? 'border-slate-800 bg-slate-800/20 opacity-50' :
                  isPrio    ? 'border-yellow-600/30 bg-yellow-900/10' :
                              'border-slate-700 bg-slate-800/30'
                }`}
              >
                <p className="text-[10px] text-slate-500 mb-0.5">{dayLabels[i]}</p>
                <p className={`text-sm font-black ${isToday2 ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {format(day, 'd')}
                </p>
                {isPrio && !isPast2 && (
                  <div className="mt-1">
                    <TrendingUp size={8} className="text-yellow-500 mx-auto" />
                  </div>
                )}
                <div className="mt-1.5 space-y-0.5">
                  {PUBLISH_TIMES.map((t) => (
                    <div
                      key={t}
                      className={`rounded text-[9px] font-mono py-0.5 ${
                        isPast(day, t)
                          ? 'bg-slate-700/30 text-slate-600'
                          : isToday2
                          ? 'bg-indigo-800/50 text-indigo-300'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Info ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">Configuración actual</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Publicaciones/día</span>
            <span className="font-bold text-slate-200">3 vídeos</span>
          </div>
          <div className="flex justify-between">
            <span>Horarios (hora Madrid)</span>
            <span className="font-bold text-slate-200">15:00 · 18:00 · 21:00</span>
          </div>
          <div className="flex justify-between">
            <span>Días prioritarios</span>
            <span className="font-bold text-yellow-400">Mié · Jue · Vie</span>
          </div>
          <div className="flex justify-between">
            <span>Research semanal</span>
            <span className="font-bold text-slate-200">Dom 3:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
