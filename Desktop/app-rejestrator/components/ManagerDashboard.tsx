'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users, Clock, TrendingUp, Bell, Settings } from 'lucide-react';

interface DowntimeEntry {
  id: string;
  machineName: string;
  operatorName: string;
  startTime: string;
  duration: number;
  comment: string;
  date: string;
  postNumber?: string;
  isActive?: boolean;
}

interface Alert {
  id: string;
  type: 'long_downtime' | 'frequent_stops' | 'machine_issue';
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  machineId?: string;
}

export default function ManagerDashboard() {
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertThreshold, setAlertThreshold] = useState(30); // minuty
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('downtimeHistory');
    if (stored) {
      const data = JSON.parse(stored);
      setDowntimeHistory(data);
      checkForAlerts(data);
    }

    // Sprawdzaj alerty co minutę
    const interval = setInterval(() => {
      const stored = localStorage.getItem('downtimeHistory');
      if (stored) {
        const data = JSON.parse(stored);
        setDowntimeHistory(data);
        checkForAlerts(data);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [alertThreshold]);

  const checkForAlerts = (data: DowntimeEntry[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.filter(d => d.date === today);
    const newAlerts: Alert[] = [];

    // Alert dla długich postojów
    todayData.forEach(entry => {
      if (entry.duration >= alertThreshold) {
        newAlerts.push({
          id: `long_${entry.id}`,
          type: 'long_downtime',
          message: `Długi postój: ${entry.machineName} - ${entry.duration} min`,
          timestamp: new Date().toISOString(),
          severity: entry.duration > 60 ? 'high' : 'medium',
          machineId: entry.machineName
        });
      }
    });

    // Alert dla częstych postojów tej samej maszyny
    const machineStops = {};
    todayData.forEach(entry => {
      machineStops[entry.machineName] = (machineStops[entry.machineName] || 0) + 1;
    });

    Object.entries(machineStops).forEach(([machine, count]) => {
      if ((count as number) >= 5) {
        newAlerts.push({
          id: `frequent_${machine}`,
          type: 'frequent_stops',
          message: `Częste postoje: ${machine} - ${count} razy dzisiaj`,
          timestamp: new Date().toISOString(),
          severity: 'medium',
          machineId: machine
        });
      }
    });

    setAlerts(newAlerts);
  };

  const todayStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayData = downtimeHistory.filter(d => d.date === today);
    
    return {
      totalStops: todayData.length,
      totalDowntime: todayData.reduce((sum, d) => sum + d.duration, 0),
      activeMachines: new Set(todayData.map(d => d.machineName)).size,
      operators: new Set(todayData.map(d => d.operatorName)).size
    };
  };

  const stats = todayStats();

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 border-red-300 text-red-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-blue-100 border-blue-300 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel Managera</h1>
            <p className="text-gray-600">Live monitoring postojów produkcyjnych</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-white rounded-lg shadow hover:bg-gray-50"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-600" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="font-semibold mb-3">Ustawienia alertów</h3>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">
                Alert przy postoju dłuższym niż:
              </label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded"
                min="1"
              />
              <span className="text-sm text-gray-600">minut</span>
            </div>
          </div>
        )}

        {/* Alerty */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Aktywne alerty
            </h3>
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.id} className={`p-3 rounded-lg border ${getAlertColor(alert.severity)}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{alert.message}</span>
                    <span className="text-xs">
                      {new Date(alert.timestamp).toLocaleTimeString('pl-PL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statystyki dzisiejsze */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Postoje dzisiaj</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalStops}</p>
              </div>
              <Clock className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Łączny czas</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalDowntime} min</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Maszyny</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeMachines}</p>
              </div>
              <Settings className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Operatorzy</p>
                <p className="text-2xl font-bold text-green-600">{stats.operators}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Live View - Ostatnie postoje */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-xl font-semibold">Live View - Ostatnie postoje</h3>
            <p className="text-gray-600">Aktualizacja co minutę</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {downtimeHistory
                .filter(d => d.date === new Date().toISOString().split('T')[0])
                .slice(0, 10)
                .map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          entry.duration > alertThreshold ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                        <div>
                          <p className="font-semibold">{entry.machineName}</p>
                          <p className="text-sm text-gray-600">{entry.comment}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.startTime).toLocaleTimeString('pl-PL')} - {entry.operatorName}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        entry.duration > alertThreshold ? 'text-red-600' : 'text-orange-600'
                      }`}>
                        {entry.duration} min
                      </p>
                      {entry.postNumber && (
                        <p className="text-sm text-blue-600">Post {entry.postNumber}</p>
                      )}
                    </div>
                  </div>
                ))}
              {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
                <p className="text-center text-gray-500 py-8">Brak postojów dzisiaj</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}