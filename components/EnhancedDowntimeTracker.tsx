'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, User, AlertCircle, QrCode, Zap, Camera } from 'lucide-react';

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

interface QuickReason {
  id: string;
  text: string;
  color: string;
  count: number;
}

export default function EnhancedDowntimeTracker() {
  const [activeDowntime, setActiveDowntime] = useState<DowntimeEntry | null>(null);
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [machineName, setMachineName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [comment, setComment] = useState('');
  const [postNumber, setPostNumber] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [quickReasons, setQuickReasons] = useState<QuickReason[]>([
    { id: '1', text: 'Awaria mechaniczna', color: 'bg-red-500', count: 0 },
    { id: '2', text: 'Brak materiału', color: 'bg-orange-500', count: 0 },
    { id: '3', text: 'Wymiana narzędzi', color: 'bg-blue-500', count: 0 },
    { id: '4', text: 'Konserwacja', color: 'bg-green-500', count: 0 },
    { id: '5', text: 'Problem jakościowy', color: 'bg-purple-500', count: 0 },
    { id: '6', text: 'Przerwa planowana', color: 'bg-gray-500', count: 0 }
  ]);

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
      const data = JSON.parse(stored);
      setDowntimeHistory(data);
      
      // Aktualizuj liczniki przyczyn
      const reasonCounts = {};
      data.forEach((entry: DowntimeEntry) => {
        reasonCounts[entry.comment] = (reasonCounts[entry.comment] || 0) + 1;
      });
      
      setQuickReasons(prev => prev.map(reason => ({
        ...reason,
        count: reasonCounts[reason.text] || 0
      })));
    }

    const activeStored = localStorage.getItem('activeDowntime');
    if (activeStored) {
      setActiveDowntime(JSON.parse(activeStored));
    }

    // Przywróć dane formularza
    const formData = localStorage.getItem('formData');
    if (formData) {
      const data = JSON.parse(formData);
      setMachineName(data.machineName || '');
      setOperatorName(data.operatorName || '');
      setPostNumber(data.postNumber || '');
    }
  }, []);

  // Zapisz dane formularza
  useEffect(() => {
    localStorage.setItem('formData', JSON.stringify({
      machineName,
      operatorName,
      postNumber
    }));
  }, [machineName, operatorName, postNumber]);

  const startDowntime = () => {
    if (!machineName.trim() || !operatorName.trim()) {
      alert('Wypełnij nazwę maszyny i operatora!');
      return;
    }

    const newDowntime: DowntimeEntry = {
      id: Date.now().toString(),
      machineName: machineName.trim(),
      operatorName: operatorName.trim(),
      startTime: new Date().toISOString(),
      duration: 0,
      comment: '',
      date: new Date().toISOString().split('T')[0],
      postNumber: postNumber.trim() || undefined,
      isActive: true
    };

    setActiveDowntime(newDowntime);
    localStorage.setItem('activeDowntime', JSON.stringify(newDowntime));
    setElapsedTime(0);
  };

  const stopDowntime = () => {
    if (!activeDowntime || !comment.trim()) {
      alert('Wybierz przyczynę postoju!');
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
      isActive: false
    };

    const newHistory = [completedDowntime, ...downtimeHistory];
    setDowntimeHistory(newHistory);
    localStorage.setItem('downtimeHistory', JSON.stringify(newHistory));
    localStorage.removeItem('activeDowntime');

    setActiveDowntime(null);
    setComment('');
    setElapsedTime(0);

    // Aktualizuj liczniki
    setQuickReasons(prev => prev.map(reason => 
      reason.text === comment.trim() 
        ? { ...reason, count: reason.count + 1 }
        : reason
    ));

    // Powiadomienie o długim postoju
    if (duration > 30) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Długi postój zakończony!', {
          body: `${activeDowntime.machineName}: ${duration} minut`,
          icon: '/icon-192x192.png'
        });
      }
    }
  };

  const selectQuickReason = (reason: QuickReason) => {
    setComment(reason.text);
  };

  const scanQRCode = () => {
    // Symulacja skanowania QR kodu
    const qrData = prompt('Zeskanuj QR kod maszyny (symulacja):');
    if (qrData) {
      const [machine, post] = qrData.split('|');
      setMachineName(machine || '');
      setPostNumber(post || '');
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Sprawdź czy to PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header z PWA info */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Rejestrator Postojów</h1>
            {isPWA && (
              <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                PWA
              </div>
            )}
          </div>
          
          {!isPWA && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                💡 Dodaj do ekranu głównego dla lepszego doświadczenia!
              </p>
            </div>
          )}
        </div>

        {/* Timer aktywnego postoju */}
        {activeDowntime && (
          <div className="bg-red-500 text-white rounded-2xl shadow-xl p-6 mb-6 animate-pulse">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">POSTÓJ AKTYWNY</h2>
              <p className="text-3xl font-mono font-bold mt-2">
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </p>
              <p className="mt-2">{activeDowntime.machineName}</p>
              <p className="text-sm opacity-90">{activeDowntime.operatorName}</p>
            </div>
          </div>
        )}

        {/* Formularz */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="space-y-4">
            {/* Maszyna z QR */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maszyna
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder="Nazwa maszyny"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!activeDowntime}
                />
                <button
                  onClick={scanQRCode}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  disabled={!!activeDowntime}
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operator
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Imię operatora"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!!activeDowntime}
              />
            </div>

            {/* Post */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numer postu (opcjonalnie)
              </label>
              <input
                type="text"
                value={postNumber}
                onChange={(e) => setPostNumber(e.target.value)}
                placeholder="Nr postu"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!!activeDowntime}
              />
            </div>

            {/* Przycisk start/stop */}
            {!activeDowntime ? (
              <button
                onClick={startDowntime}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
              >
                <Play className="w-6 h-6" />
                ROZPOCZNIJ POSTÓJ
              </button>
            ) : (
              <div className="space-y-4">
                {/* Szybkie przyczyny */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Przyczyna postoju
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {quickReasons.map(reason => (
                      <button
                        key={reason.id}
                        onClick={() => selectQuickReason(reason)}
                        className={`${reason.color} ${
                          comment === reason.text ? 'ring-4 ring-white ring-opacity-50' : ''
                        } text-white p-3 rounded-xl text-sm font-medium transition-all hover:scale-105 relative`}
                      >
                        {reason.text}
                        {reason.count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {reason.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* Własna przyczyna */}
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Lub wpisz własną przyczynę..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={stopDowntime}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
                >
                  <Square className="w-6 h-6" />
                  ZAKOŃCZ POSTÓJ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dzisiejsze postoje */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dzisiejsze postoje</h3>
          <div className="space-y-3">
            {downtimeHistory
              .filter(d => d.date === new Date().toISOString().split('T')[0])
              .slice(0, 5)
              .map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{entry.machineName}</p>
                    <p className="text-sm text-gray-600">{entry.comment}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(entry.startTime).toLocaleTimeString('pl-PL', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })} - {entry.operatorName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{entry.duration} min</p>
                    {entry.postNumber && (
                      <p className="text-xs text-blue-600">Post {entry.postNumber}</p>
                    )}
                  </div>
                </div>
              ))}
            {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
              <p className="text-center text-gray-500 py-4">Brak postojów dzisiaj</p>
            )}
          </div>
        </div>

        {/* Przycisk powiadomień */}
        {!isPWA && 'Notification' in window && Notification.permission === 'default' && (
          <button
            onClick={requestNotificationPermission}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            Włącz powiadomienia
          </button>
        )}
      </div>
    </div>
  );
}