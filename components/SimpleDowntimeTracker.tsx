'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, User, AlertCircle } from 'lucide-react';

const MACHINES = [
  { id: 'm1', name: 'Hjullaster', color: 'bg-blue-500' },
  { id: 'm2', name: 'Tømmerbord', color: 'bg-green-500' },
  { id: 'm3', name: 'Tømmerhest, Enstokkmater, Rotreduserer', color: 'bg-yellow-500' },
  { id: 'm4', name: 'Hev/Senk, Barkemaskin', color: 'bg-purple-500' },
  { id: 'm5', name: 'Styreverk, Avkast, Innmating', color: 'bg-red-500' },
  { id: 'm6', name: 'Barktransport', color: 'bg-indigo-500' },
  { id: 'm7', name: 'Reduserere', color: 'bg-pink-500' },
  { id: 'm8', name: 'Transport inkl. Vendere', color: 'bg-orange-500' },
  { id: 'm9', name: 'FR 16, Bordavskiller, Bordtransport', color: 'bg-teal-500' },
  { id: 'm10', name: 'FR15/FR12', color: 'bg-cyan-500' },
  { id: 'm11', name: 'Avkast, Buffertransport, Elevator', color: 'bg-lime-500' },
  { id: 'm12', name: 'Råsortering', color: 'bg-emerald-500' },
  { id: 'm13', name: 'Strølegger', color: 'bg-violet-500' },
  { id: 'm14', name: 'Omposting/Korigering', color: 'bg-fuchsia-500' },
  { id: 'm15', name: 'Bladbytte', color: 'bg-rose-500' },
  { id: 'm16', name: 'Diverse', color: 'bg-slate-500' },
];

interface DowntimeEntry {
  id: string;
  machineName: string;
  operatorName: string;
  startTime: string;
  endTime?: string;
  duration: number;
  comment: string;
  date: string;
  postNumber?: string;
  isActive?: boolean;
}

export default function SimpleDowntimeTracker() {
  const [activeDowntime, setActiveDowntime] = useState<DowntimeEntry | null>(null);
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [operatorName, setOperatorName] = useState('');
  const [comment, setComment] = useState('');
  const [postNumber, setPostNumber] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showCommentModal, setShowCommentModal] = useState(false);

  // Timer dla aktywnego postoju
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeDowntime) {
      interval = setInterval(() => {
        const now = new Date();
        const start = new Date(activeDowntime.startTime);
        setElapsedTime(Math.floor((now.getTime() - start.getTime()) / 60000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeDowntime]);

  // Ładowanie danych
  useEffect(() => {
    const stored = localStorage.getItem('downtimeHistory');
    if (stored) {
      setDowntimeHistory(JSON.parse(stored));
    }

    const activeStored = localStorage.getItem('activeDowntime');
    if (activeStored) {
      setActiveDowntime(JSON.parse(activeStored));
    }

    // Przywróć dane operatora
    const operatorStored = localStorage.getItem('operatorName');
    if (operatorStored) {
      setOperatorName(operatorStored);
    }
  }, []);

  // Zapisz dane operatora
  useEffect(() => {
    if (operatorName) {
      localStorage.setItem('operatorName', operatorName);
    }
  }, [operatorName]);

  const startDowntime = (machine: any) => {
    if (!operatorName.trim()) {
      alert('Skriv inn operatørnavn først!');
      return;
    }

    const newDowntime: DowntimeEntry = {
      id: Date.now().toString(),
      machineName: machine.name,
      operatorName: operatorName.trim(),
      startTime: new Date().toISOString(),
      duration: 0,
      comment: '',
      date: new Date().toISOString().split('T')[0],
      isActive: true
    };

    setActiveDowntime(newDowntime);
    localStorage.setItem('activeDowntime', JSON.stringify(newDowntime));
    setElapsedTime(0);
  };

  const stopDowntime = () => {
    if (!activeDowntime) return;
    setShowCommentModal(true);
  };

  const confirmStopDowntime = () => {
    if (!activeDowntime || !comment.trim()) {
      alert('Skriv inn årsak til stans!');
      return;
    }

    const endTime = new Date();
    const startTime = new Date(activeDowntime.startTime);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

    const completedDowntime: DowntimeEntry = {
      ...activeDowntime,
      endTime: endTime.toISOString(),
      duration,
      comment: comment.trim(),
      postNumber: postNumber.trim() || undefined,
      isActive: false
    };

    const newHistory = [completedDowntime, ...downtimeHistory];
    setDowntimeHistory(newHistory);
    localStorage.setItem('downtimeHistory', JSON.stringify(newHistory));
    localStorage.removeItem('activeDowntime');

    setActiveDowntime(null);
    setComment('');
    setPostNumber('');
    setElapsedTime(0);
    setShowCommentModal(false);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    return `${mins} min`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Rejestrator Postojów</h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Haslestad - Avdeling Saga</p>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString('nb-NO')}</p>
              </div>
            </div>
          </div>
          
          {/* Operator input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operatør
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Skriv inn ditt navn"
              className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={!!activeDowntime}
            />
          </div>

          {/* DAG ITO button */}
          <div className="flex gap-4">
            <button
              onClick={() => setOperatorName('DAG')}
              disabled={!!activeDowntime}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-colors ${
                operatorName === 'DAG' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } ${activeDowntime ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              DAG ITO
            </button>
            <button
              onClick={() => setOperatorName('KVELD')}
              disabled={!!activeDowntime}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-colors ${
                operatorName === 'KVELD' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } ${activeDowntime ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              KVELD
            </button>
          </div>
        </div>

        {/* Timer aktywnego postoju */}
        {activeDowntime && (
          <div className="bg-red-500 text-white rounded-2xl shadow-xl p-6 mb-6 animate-pulse">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-2xl font-bold">POSTÓJ AKTYWNY</h2>
              <p className="text-4xl font-mono font-bold mt-2">
                {formatDuration(elapsedTime)}
              </p>
              <p className="text-xl mt-2">{activeDowntime.machineName}</p>
              <p className="text-lg opacity-90">{activeDowntime.operatorName}</p>
              <button
                onClick={stopDowntime}
                className="mt-4 bg-white text-red-500 font-bold py-3 px-8 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 mx-auto"
              >
                <Square className="w-5 h-5" />
                STOPP STANS
              </button>
            </div>
          </div>
        )}

        {/* Machine buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {MACHINES.map(machine => {
            const isActive = activeDowntime?.machineName === machine.name;
            
            return (
              <button
                key={machine.id}
                onClick={() => !activeDowntime && startDowntime(machine)}
                disabled={!!activeDowntime || !operatorName.trim()}
                className={`relative h-32 rounded-2xl transition-all duration-200 border ${
                  isActive 
                    ? 'bg-red-500 border-red-600 text-white animate-pulse' 
                    : activeDowntime
                      ? 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400'
                      : !operatorName.trim()
                        ? 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg active:scale-95 text-gray-900'
                }`}
              >
                <div className="flex flex-col items-center justify-center h-full p-4">
                  {/* Icon */}
                  <div className={`mb-3 p-3 rounded-full ${
                    isActive ? 'bg-white/20' : machine.color
                  }`}>
                    {isActive ? (
                      <Clock className="w-5 h-5 text-white animate-pulse" />
                    ) : (
                      <Play className="w-5 h-5 text-white" />
                    )}
                  </div>
                  
                  {/* Machine name */}
                  <span className="font-medium text-sm text-center leading-tight">
                    {machine.name}
                  </span>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <div className="mt-2 text-xs font-bold">
                      AKTIV: {formatDuration(elapsedTime)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Dzisiejsze postoje */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Dagens stanser</h3>
          <div className="space-y-3">
            {downtimeHistory
              .filter(d => d.date === new Date().toISOString().split('T')[0])
              .slice(0, 10)
              .map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{entry.machineName}</p>
                    <p className="text-sm text-gray-600">{entry.comment}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(entry.startTime).toLocaleTimeString('nb-NO', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })} - {entry.operatorName}
                      {entry.postNumber && ` (Post ${entry.postNumber})`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{entry.duration} min</p>
                  </div>
                </div>
              ))}
            {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
              <p className="text-center text-gray-500 py-8">Ingen stanser i dag</p>
            )}
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold mb-2">
                Avslutt stans
              </h2>
              <p className="text-blue-100">
                {activeDowntime?.machineName}
              </p>
              <div className="mt-3 bg-white/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Varighet:</span>
                  <span className="text-xl font-bold">
                    {formatDuration(elapsedTime)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              {activeDowntime?.machineName === 'Omposting/Korigering' && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Post Nr *
                  </label>
                  <input
                    type="text"
                    value={postNumber}
                    onChange={(e) => setPostNumber(e.target.value)}
                    placeholder="F.eks. 1, 2, 3..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                    autoFocus
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Årsak til stans *
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Beskriv hva som skjedde..."
                  className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-32 resize-none text-base"
                  autoFocus={activeDowntime?.machineName !== 'Omposting/Korigering'}
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={confirmStopDowntime}
                  disabled={!comment.trim() || (activeDowntime?.machineName === 'Omposting/Korigering' && !postNumber.trim())}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-bold text-lg"
                >
                  LAGRE STANS
                </button>
                
                <button
                  onClick={() => {
                    setShowCommentModal(false);
                    setComment('');
                    setPostNumber('');
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}