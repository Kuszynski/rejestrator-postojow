'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface DowntimeEntry {
  id: string;
  machineName: string;
  startTime: string;
  duration: number;
  comment: string;
  date: string;
}

export default function HeatmapChart() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('downtimeHistory');
    if (stored) {
      setDowntimeHistory(JSON.parse(stored));
    }
  }, []);

  const getDaysInMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  const getDowntimeForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayDowntimes = downtimeHistory.filter(d => d.date === dateStr);
    return dayDowntimes.reduce((sum, d) => sum + d.duration, 0);
  };

  const getMaxDowntime = () => {
    const days = getDaysInMonth();
    return Math.max(...days.map(day => getDowntimeForDate(day)), 1);
  };

  const getIntensityColor = (minutes: number, maxMinutes: number) => {
    if (minutes === 0) return '#f3f4f6';
    const intensity = minutes / maxMinutes;
    if (intensity <= 0.2) return '#bbf7d0';
    if (intensity <= 0.4) return '#fde047';
    if (intensity <= 0.6) return '#fb923c';
    if (intensity <= 0.8) return '#f87171';
    return '#dc2626';
  };

  const days = getDaysInMonth();
  const maxDowntime = getMaxDowntime();
  const monthName = selectedMonth.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Heatmap - Stanser per dag
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-3 capitalize">
            {monthName}
          </span>
          <button
            onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ukedager */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(day => (
          <div key={day} className="text-xs text-center text-gray-500 py-1 font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Kalendergrid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {/* Tomme celler for første uke */}
        {Array.from({ length: (days[0].getDay() + 6) % 7 }, (_, i) => (
          <div key={`empty-${i}`} className="aspect-square"></div>
        ))}
        
        {/* Dager */}
        {days.map(day => {
          const downtime = getDowntimeForDate(day);
          const colorClass = getIntensityColor(downtime, maxDowntime);
          const isToday = day.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={day.toISOString()}
              style={{
                aspectRatio: '1',
                backgroundColor: getIntensityColor(downtime, maxDowntime),
                border: isToday ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                minHeight: '32px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title={`${day.getDate()}. ${day.toLocaleDateString('nb-NO', { month: 'short' })}: ${downtime} min stanser`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
        <span>Mindre</span>
        <div className="flex gap-1">
          <div style={{ width: '12px', height: '12px', backgroundColor: '#f3f4f6', borderRadius: '2px' }}></div>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#bbf7d0', borderRadius: '2px' }}></div>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#fde047', borderRadius: '2px' }}></div>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#fb923c', borderRadius: '2px' }}></div>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#f87171', borderRadius: '2px' }}></div>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '2px' }}></div>
        </div>
        <span>Mer</span>
      </div>

      {/* Statistikk */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">
            {days.reduce((sum, day) => sum + getDowntimeForDate(day), 0)} min
          </div>
          <div className="text-xs text-gray-600">Total stansetid</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">
            {days.filter(day => getDowntimeForDate(day) > 0).length}
          </div>
          <div className="text-xs text-gray-600">Dager med stanser</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">
            {Math.round(days.reduce((sum, day) => sum + getDowntimeForDate(day), 0) / days.length)} min
          </div>
          <div className="text-xs text-gray-600">Gjennomsnitt per dag</div>
        </div>
      </div>
    </div>
  );
}