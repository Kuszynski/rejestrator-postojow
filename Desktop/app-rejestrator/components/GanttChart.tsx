'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DowntimeEntry {
  id: string;
  machineName: string;
  startTime: string;
  endTime?: string;
  duration: number;
  comment: string;
  date: string;
}

export default function GanttChart() {
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

  const getWorkHours = (dayOfWeek: number) => {
    if (dayOfWeek === 0 || dayOfWeek === 6) return null; // Weekend
    if (dayOfWeek === 5) return { start: 6, end: 14 }; // Fredag
    return { start: 6, end: 23 }; // Man-Tor
  };

  const getDowntimesForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return downtimeHistory.filter(d => d.date === dateStr);
  };

  const weekDays = getWeekDays();
  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Gantt-diagram
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek(new Date(selectedWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-3">
            Uke {Math.ceil((selectedWeek.getTime() - new Date(selectedWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}
          </span>
          <button
            onClick={() => setSelectedWeek(new Date(selectedWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500"></div>
          <span>Arbeid</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-400"></div>
          <span>Pause</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500"></div>
          <span>Stans</span>
        </div>
      </div>

      {/* Tidsakse */}
      <div className="mb-2">
        <div className="flex">
          <div className="w-16"></div>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="flex-1 text-xs text-center text-gray-500 min-w-[30px]">
              {6 + i}
            </div>
          ))}
        </div>
      </div>

      {/* Dager */}
      <div className="space-y-1">
        {weekDays.map((date, index) => {
          const dayOfWeek = date.getDay();
          const workHours = getWorkHours(dayOfWeek);
          const downtimes = getDowntimesForDay(date);
          const totalDowntime = downtimes.reduce((sum, d) => sum + d.duration, 0);

          return (
            <div key={index} className="flex items-center">
              {/* Dag navn */}
              <div className="w-16 text-sm font-medium">
                <div>{dayNames[index]}</div>
                <div className="text-xs text-gray-500">
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 relative h-8 bg-gray-100 border">
                {workHours ? (
                  <>
                    {/* Arbeidstid */}
                    <div
                      className="absolute h-full bg-green-500"
                      style={{
                        left: `${((workHours.start - 6) / 18) * 100}%`,
                        width: `${((workHours.end - workHours.start) / 18) * 100}%`
                      }}
                    />
                    
                    {/* Pauser */}
                    {dayOfWeek !== 5 && (
                      <>
                        <div
                          className="absolute h-full bg-yellow-400"
                          style={{
                            left: `${((9 - 6) / 18) * 100}%`,
                            width: `${(0.5 / 18) * 100}%`
                          }}
                        />
                        <div
                          className="absolute h-full bg-yellow-400"
                          style={{
                            left: `${((19 - 6) / 18) * 100}%`,
                            width: `${(0.5 / 18) * 100}%`
                          }}
                        />
                      </>
                    )}
                    {dayOfWeek === 5 && (
                      <div
                        className="absolute h-full bg-yellow-400"
                        style={{
                          left: `${((9 - 6) / 18) * 100}%`,
                          width: `${(0.5 / 18) * 100}%`
                        }}
                      />
                    )}

                    {/* Stanser */}
                    {downtimes.map((downtime) => {
                      const startTime = new Date(downtime.startTime);
                      const hour = startTime.getHours() + startTime.getMinutes() / 60;
                      const durationHours = downtime.duration / 60;
                      
                      if (hour < 6 || hour > 23) return null;
                      
                      return (
                        <div
                          key={downtime.id}
                          className="absolute h-full bg-red-500 opacity-80"
                          style={{
                            left: `${((hour - 6) / 18) * 100}%`,
                            width: `${Math.max((durationHours / 18) * 100, 1)}%`
                          }}
                          title={`${downtime.comment} (${downtime.duration} min)`}
                        />
                      );
                    })}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    Helg
                  </div>
                )}

                {/* Tidslinjer */}
                {Array.from({ length: 19 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-gray-300"
                    style={{ left: `${(i / 18) * 100}%` }}
                  />
                ))}
              </div>

              {/* Stansetid */}
              <div className="w-16 text-right text-sm">
                {totalDowntime > 0 && (
                  <span className="text-red-600 font-medium">
                    {totalDowntime}m
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sammendrag */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="font-medium mb-2">Ukeoversikt:</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total stansetid:</div>
            <div className="font-bold text-red-600">
              {weekDays.reduce((sum, date) => 
                sum + getDowntimesForDay(date).reduce((s, d) => s + d.duration, 0), 0
              )} min
            </div>
          </div>
          <div>
            <div className="text-gray-600">Antall stanser:</div>
            <div className="font-bold">
              {weekDays.reduce((sum, date) => sum + getDowntimesForDay(date).length, 0)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Effektivitet:</div>
            <div className="font-bold text-green-600">
              {(() => {
                const totalWorkTime = 4 * 17 * 60 + 1 * 8 * 60;
                const totalDowntime = weekDays.reduce((sum, date) => 
                  sum + getDowntimesForDay(date).reduce((s, d) => s + d.duration, 0), 0
                );
                return ((totalWorkTime - totalDowntime) / totalWorkTime * 100).toFixed(1);
              })()}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}