'use client';

import { useState, useEffect } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

interface DowntimeEntry {
  id: string;
  machineName: string;
  startTime: string;
  duration: number;
  comment: string;
  date: string;
}

export default function SimpleChart() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('downtimeHistory');
    if (stored) {
      setDowntimeHistory(JSON.parse(stored));
    }
  }, []);

  const getWeekDays = () => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() - start.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  };

  const getDowntimeForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayDowntimes = downtimeHistory.filter(d => d.date === dateStr);
    return dayDowntimes.reduce((sum, d) => sum + d.duration, 0);
  };

  const weekDays = getWeekDays();
  const maxDowntime = Math.max(...weekDays.map(day => getDowntimeForDate(day)), 1);
  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Stanser denne uken
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek(new Date(selectedWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-3">
            {weekDays[0].toLocaleDateString('nb-NO')} - {weekDays[6].toLocaleDateString('nb-NO')}
          </span>
          <button
            onClick={() => setSelectedWeek(new Date(selectedWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 flex items-end justify-between gap-2 mb-4 p-4 bg-gray-50 rounded">
        {weekDays.map((date, index) => {
          const downtime = getDowntimeForDate(date);
          const height = maxDowntime > 0 ? (downtime / maxDowntime) * 200 : 0;
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              {/* Bar */}
              <div
                className="w-full max-w-12 rounded-t"
                style={{
                  height: `${Math.max(height, 4)}px`,
                  backgroundColor: downtime === 0 ? '#10b981' : downtime > 60 ? '#dc2626' : '#f59e0b',
                  border: isToday ? '2px solid #3b82f6' : 'none'
                }}
                title={`${dayNames[index]}: ${downtime} min`}
              />
              
              {/* Value */}
              <div className="text-xs font-bold mt-1 text-center">
                {downtime > 0 ? `${downtime}m` : '0'}
              </div>
              
              {/* Day */}
              <div className={`text-xs mt-1 ${isToday ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                {dayNames[index]}
              </div>
              
              {/* Date */}
              <div className="text-xs text-gray-400">
                {date.getDate()}/{date.getMonth() + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Ingen stanser</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>Moderate stanser</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-600 rounded"></div>
          <span>Mange stanser (&gt;60min)</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">
            {weekDays.reduce((sum, day) => sum + getDowntimeForDate(day), 0)} min
          </div>
          <div className="text-xs text-gray-600">Total denne uken</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">
            {weekDays.filter(day => getDowntimeForDate(day) > 0).length}
          </div>
          <div className="text-xs text-gray-600">Dager med stanser</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">
            {Math.round(weekDays.reduce((sum, day) => sum + getDowntimeForDate(day), 0) / 7)} min
          </div>
          <div className="text-xs text-gray-600">Gjennomsnitt per dag</div>
        </div>
      </div>
    </div>
  );
}