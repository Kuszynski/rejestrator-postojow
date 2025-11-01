'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users, Clock, TrendingUp, Bell, Settings, Wrench } from 'lucide-react';
import MachineManager from './MachineManager';
import { supabase } from '@/lib/supabase';

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

interface Machine {
  id: string;
  name: string;
  color: string;
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
  const [activeDowntimes, setActiveDowntimes] = useState<DowntimeEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertThreshold, setAlertThreshold] = useState(30); // minuty
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'machines'>('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<'today' | 'yesterday'>('today');

  useEffect(() => {
    const initializeData = async () => {
      await loadMachines();
    };
    initializeData();

    // Aktualizuj czas co sekundę
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Odśwież dane co 5 sekund
    const dataInterval = setInterval(() => {
      loadDowntimes();
      loadActiveDowntimes();
    }, 5000);

    // Subskrypcja real-time dla postojów
    const subscription = supabase
      .channel('downtimes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'downtimes' },
        (payload) => {
          console.log('Real-time update received:', payload);
          loadDowntimes();
          loadActiveDowntimes();
        }
      )
      .subscribe();

    console.log('Real-time subscription status:', subscription);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
      subscription.unsubscribe();
    };
  }, []);

  // Ładuj dane po załadowaniu maszyn lub zmianie daty
  useEffect(() => {
    console.log('Machines loaded:', machines.length);
    if (machines.length > 0) {
      console.log('Loading downtimes and active downtimes...');
      loadDowntimes(machines);
      loadActiveDowntimes(machines);
    }
  }, [machines, selectedDate]);

  // Debug aktywnych postojów
  useEffect(() => {
    console.log('Active downtimes state updated:', activeDowntimes);
  }, [activeDowntimes]);

  useEffect(() => {
    console.log('Checking alerts for:', downtimeHistory.length, 'completed and', activeDowntimes.length, 'active downtimes');
    checkForAlerts([...downtimeHistory, ...activeDowntimes]);
  }, [downtimeHistory, activeDowntimes, alertThreshold]);

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading machines:', error);
        // Fallback do domyślnych maszyn
        const defaultMachines = [
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
        setMachines(defaultMachines);
        return;
      }

      setMachines(data || []);
    } catch (error) {
      console.error('Unexpected error loading machines:', error);
    }
  };

  const loadDowntimes = async (machinesList: Machine[] = machines) => {
    try {
      const targetDate = selectedDate === 'today' 
        ? new Date().toISOString().split('T')[0]
        : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .eq('date', targetDate)
        .eq('is_active', false)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading downtimes:', error);
        return;
      }

      const formattedData = data?.map(item => ({
        id: item.id.toString(),
        machineName: machinesList.find(m => m.id === item.machine_id)?.name || item.machine_id,
        operatorName: item.operator_id,
        startTime: item.start_time,
        endTime: item.end_time,
        duration: item.duration || 0,
        comment: item.comment || '',
        date: item.date,
        postNumber: item.post_number,
        isActive: false
      })) || [];

      setDowntimeHistory(formattedData);
    } catch (error) {
      console.error('Unexpected error loading downtimes:', error);
    }
  };

  const loadActiveDowntimes = async (machinesList: Machine[] = machines) => {
    try {
      // Aktywne postoje zawsze tylko z dzisiaj
      const today = new Date().toISOString().split('T')[0];
      console.log('Loading active downtimes for date:', today);
      
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .eq('date', today)
        .eq('is_active', true)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading active downtimes:', error);
        return;
      }

      console.log('Active downtimes from DB:', data);

      const formattedData = data?.map(item => {
        const machine = machinesList.find(m => m.id === item.machine_id);
        const machineName = machine ? machine.name : `Maszyna ${item.machine_id}`;
        
        return {
          id: item.id.toString(),
          machineName: machineName,
          operatorName: item.operator_id,
          startTime: item.start_time,
          duration: Math.floor((currentTime.getTime() - new Date(item.start_time).getTime()) / 60000),
          comment: item.comment || '',
          date: item.date,
          postNumber: item.post_number,
          isActive: true
        };
      }) || [];

      console.log('Formatted active downtimes:', formattedData);
      setActiveDowntimes(formattedData);
    } catch (error) {
      console.error('Unexpected error loading active downtimes:', error);
    }
  };

  const checkForAlerts = (data: DowntimeEntry[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.filter(d => d.date === today);
    const newAlerts: Alert[] = [];

    // Alert dla długich postojów (aktywnych i zakończonych)
    todayData.forEach(entry => {
      if (entry.duration >= alertThreshold) {
        newAlerts.push({
          id: `long_${entry.id}`,
          type: 'long_downtime',
          message: `${entry.isActive ? 'Aktywny długi postój' : 'Długi postój'}: ${entry.machineName} - ${entry.duration} min`,
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

  const getStats = () => {
    const targetDate = selectedDate === 'today' 
      ? new Date().toISOString().split('T')[0]
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const dateData = downtimeHistory.filter(d => d.date === targetDate);
    const activeData = selectedDate === 'today' ? activeDowntimes.filter(d => d.date === targetDate) : [];
    const allData = [...dateData, ...activeData];
    
    return {
      totalStops: allData.length,
      totalDowntime: allData.reduce((sum, d) => sum + d.duration, 0),
      activeMachines: new Set(allData.map(d => d.machineName)).size,
      operators: new Set(allData.map(d => d.operatorName)).size,
      activeStops: activeData.length
    };
  };

  const stats = getStats();

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

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Dashboard
              </div>
            </button>
            <button
              onClick={() => setActiveTab('machines')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'machines'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Maskiner
              </div>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && activeTab === 'dashboard' && (
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

        {/* Content based on active tab */}
        {activeTab === 'dashboard' && (
          <>
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

            {/* Przełącznik dat */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDate('today')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedDate === 'today'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Dzisiaj
                </button>
                <button
                  onClick={() => setSelectedDate('yesterday')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedDate === 'yesterday'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Wczoraj
                </button>
              </div>
            </div>

            {/* Statystyki */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Postoje {selectedDate === 'today' ? 'dzisiaj' : 'wczoraj'}</p>
                    <p className="text-2xl font-bold text-red-600">{stats.totalStops}</p>
                    {stats.activeStops > 0 && (
                      <p className="text-xs text-red-500 font-medium animate-pulse">
                        {stats.activeStops} aktywny{stats.activeStops > 1 ? 'ch' : ''}
                      </p>
                    )}
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

            {/* Live View - Aktywne i ostatnie postoje */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold">
                  Oversikt - {selectedDate === 'today' ? 'Live View' : 'Wczorajsze postoje'}
                </h3>
                <p className="text-gray-600">
                  {selectedDate === 'today' ? 'Aktualizacja w czasie rzeczywistym' : 'Postoje z wczoraj'}
                </p>
                {stats.activeStops > 0 && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    {stats.activeStops} aktywny{stats.activeStops > 1 ? 'ch' : ''} postój{stats.activeStops > 1 ? 'ów' : ''}
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Aktywne postoje - tylko dla dzisiaj */}
                  {selectedDate === 'today' && activeDowntimes.map(entry => {
                    const duration = Math.floor((currentTime.getTime() - new Date(entry.startTime).getTime()) / 60000);
                    return (
                      <div key={`active_${entry.id}`} className="flex items-center justify-between p-4 bg-red-50 border-2 border-red-200 rounded-lg animate-pulse">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-red-800">{entry.machineName}</p>
                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                                  AKTYWNY
                                </span>
                              </div>
                              <p className="text-sm text-red-600">Postój w toku...</p>
                              <p className="text-xs text-red-500">
                                {new Date(entry.startTime).toLocaleTimeString('pl-PL')} - {entry.operatorName}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-600 animate-pulse">
                            {duration} min
                          </p>
                          <p className="text-sm text-red-500 font-medium">⏱️ Trwa</p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Zakończone postoje */}
                  {downtimeHistory
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
                  
                  {downtimeHistory.length === 0 && (selectedDate === 'yesterday' || activeDowntimes.length === 0) && (
                    <p className="text-center text-gray-500 py-8">
                      Brak postojów {selectedDate === 'today' ? 'dzisiaj' : 'wczoraj'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Machine Management Tab */}
        {activeTab === 'machines' && (
          <MachineManager />
        )}
      </div>
    </div>
  );
}