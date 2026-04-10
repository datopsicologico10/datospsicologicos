import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, TrendingUp, Calendar } from 'lucide-react';

// Horarios de publicación configurados
const PUBLISH_TIMES = ['15:00', '18:00', '21:00'];
const PRIORITY_DAYS = [3, 4, 5]; // mié, jue, vie

function getDaySlots(date) {
  return PUBLISH_TIMES.map((time) => ({
    time,
    isPriority: PRIORITY_DAYS.includes(date.getDay()),
    date,
  }));
}

export default function ContentCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-indigo-400" />
          <h3 className="text-base font-semibold">Calendario de publicación</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            ←
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            Hoy
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            →
          </button>
        </div>
      </div>

      {/* Semana */}
      <div className="text-xs text-slate-400 text-center">
        {format(weekStart, 'd MMM', { locale: es })} —{' '}
        {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: es })}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isPriority = PRIORITY_DAYS.includes(day.getDay());
          const slots = getDaySlots(day);

          return (
            <div
              key={i}
              className={`rounded-xl border p-2 space-y-1.5 ${
                isToday
                  ? 'border-indigo-500 bg-indigo-950/40'
                  : isPriority
                  ? 'border-yellow-600/40 bg-yellow-950/20'
                  : 'border-slate-700 bg-slate-800/40'
              }`}
            >
              {/* Cabecera del día */}
              <div className="text-center">
                <p className="text-xs text-slate-400">{dayNames[i]}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-indigo-300' : ''}`}>
                  {format(day, 'd')}
                </p>
                {isPriority && (
                  <TrendingUp size={10} className="text-yellow-400 mx-auto" />
                )}
              </div>

              {/* Slots de publicación */}
              {slots.map((slot) => (
                <div
                  key={slot.time}
                  className={`rounded-lg px-1.5 py-1 text-center ${
                    isPriority
                      ? 'bg-yellow-900/40 border border-yellow-700/40'
                      : 'bg-slate-700/50 border border-slate-600/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Clock size={8} className="text-slate-400" />
                    <span className="text-xs font-mono text-slate-300">{slot.time}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-900/60 border border-yellow-600/40" />
          <span>Días prioritarios (mié-vie)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-950/60 border border-indigo-500/60" />
          <span>Hoy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={10} />
          <span>3 publicaciones / día (15h, 18h, 21h CET)</span>
        </div>
      </div>
    </div>
  );
}
