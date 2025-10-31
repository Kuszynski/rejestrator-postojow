import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, TrendingUp, BarChart3, Calendar, LogOut, AlertCircle, CheckCircle, Edit2, Trash2, Eye } from 'lucide-react';

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

const USERS = [
  { id: 'op1', username: 'operatør', password: 'operator123', role: 'operator', name: 'Jan Hansen' },
  { id: 'mg1', username: 'sjef', password: 'sjef123', role: 'manager', name: 'Per Olsen' },
];

export default function DowntimeTracker() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeDowntimes, setActiveDowntimes] = useState([]);
  const [downtimeHistory, setDowntimeHistory] = useState([]);
  const [commentModal, setCommentModal] = useState(null);
  const [comment, setComment] = useState('');
  const [view, setView] = useState('main');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [editModal, setEditModal] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [postNumber, setPostNumber] = useState('');
  const [editPostNumber, setEditPostNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user?.role === 'operator') {
      const interval = setInterval(() => {
        setActiveDowntimes(prev => [...prev]);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadData = async () => {
    try {
      const historyResult = await window.storage.get('downtime-history');
      if (historyResult) {
        setDowntimeHistory(JSON.parse(historyResult.value));
      }
    } catch (error) {
      setDowntimeHistory([]);
    }
    setLoading(false);
  };

  const saveHistory = async (history) => {
    try {
      await window.storage.set('downtime-history', JSON.stringify(history));
    } catch (error) {
      console.error('Lagringsfeil:', error);
    }
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    const foundUser = USERS.find(
      u => u.username === loginForm.username && u.password === loginForm.password
    );
    if (foundUser) {
      setUser(foundUser);
      setLoginForm({ username: '', password: '' });
    } else {
      alert('Feil brukernavn eller passord');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('main');
    setActiveDowntimes([]);
  };

  const startDowntime = (machine) => {
    const newDowntime = {
      id: Date.now(),
      machineId: machine.id,
      machineName: machine.name,
      startTime: Date.now(),
      operatorId: user.id,
      operatorName: user.name,
    };
    setActiveDowntimes([...activeDowntimes, newDowntime]);
  };

  const stopDowntime = (downtime) => {
    setCommentModal(downtime);
    if (downtime.machineName === 'Omposting/Korigering') {
      setPostNumber('');
    }
  };

  const confirmStop = () => {
    if (!comment.trim()) {
      alert('Vennligst skriv inn årsak til stans');
      return;
    }

    if (commentModal.machineName === 'Omposting/Korigering' && !postNumber.trim()) {
      alert('Vennligst skriv inn Post Nr for omposting');
      return;
    }

    const endTime = Date.now();
    const duration = Math.floor((endTime - commentModal.startTime) / 1000 / 60);
    
    const completedDowntime = {
      ...commentModal,
      endTime,
      duration,
      comment: comment.trim(),
      postNumber: commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : undefined,
      date: new Date().toISOString().split('T')[0],
    };

    const newHistory = [completedDowntime, ...downtimeHistory];
    setDowntimeHistory(newHistory);
    saveHistory(newHistory);
    setActiveDowntimes(activeDowntimes.filter(d => d.id !== commentModal.id));
    setCommentModal(null);
    setComment('');
    setPostNumber('');
  };

  const openEditModal = (downtime) => {
    setEditModal(downtime);
    setEditComment(downtime.comment);
    setEditDuration(downtime.duration.toString());
    setEditPostNumber(downtime.postNumber || '');
  };

  const saveEdit = () => {
    if (!editComment.trim()) {
      alert('Vennligst skriv inn årsak til stans');
      return;
    }
    
    const newDuration = parseInt(editDuration);
    if (isNaN(newDuration) || newDuration <= 0) {
      alert('Vennligst skriv inn gyldig varighet');
      return;
    }

    if (editModal.machineName === 'Omposting/Korigering' && !editPostNumber.trim()) {
      alert('Vennligst skriv inn Post Nr for omposting');
      return;
    }

    const updatedHistory = downtimeHistory.map(d => 
      d.id === editModal.id 
        ? { 
            ...d, 
            comment: editComment.trim(), 
            duration: newDuration,
            postNumber: editModal.machineName === 'Omposting/Korigering' ? editPostNumber.trim() : d.postNumber
          }
        : d
    );
    
    setDowntimeHistory(updatedHistory);
    saveHistory(updatedHistory);
    setEditModal(null);
    setEditComment('');
    setEditDuration('');
    setEditPostNumber('');
  };

  const getPostingStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayDowntimes = downtimeHistory.filter(d => d.date === today);
    
    const ompostings = todayDowntimes
      .filter(d => d.machineName === 'Omposting/Korigering' && d.postNumber)
      .sort((a, b) => a.startTime - b.startTime);
    
    if (ompostings.length === 0) {
      const totalToday = todayDowntimes.reduce((sum, d) => sum + d.duration, 0);
      return [{
        postNumber: 'Start av dagen',
        startTime: null,
        downtimes: todayDowntimes,
        totalDuration: totalToday
      }];
    }

    const periods = [];
    
    const beforeFirst = todayDowntimes.filter(d => 
      d.startTime < ompostings[0].startTime && d.machineName !== 'Omposting/Korigering'
    );
    if (beforeFirst.length > 0) {
      periods.push({
        postNumber: 'Før Post ' + ompostings[0].postNumber,
        startTime: null,
        endTime: ompostings[0].startTime,
        downtimes: beforeFirst,
        totalDuration: beforeFirst.reduce((sum, d) => sum + d.duration, 0)
      });
    }

    ompostings.forEach((omposting, idx) => {
      const nextOmposting = ompostings[idx + 1];
      const periodDowntimes = todayDowntimes.filter(d => {
        if (d.machineName === 'Omposting/Korigering') return false;
        if (d.startTime < omposting.startTime) return false;
        if (nextOmposting && d.startTime >= nextOmposting.startTime) return false;
        return true;
      });

      periods.push({
        postNumber: 'Post ' + omposting.postNumber,
        startTime: omposting.startTime,
        endTime: nextOmposting ? nextOmposting.startTime : null,
        downtimes: periodDowntimes,
        totalDuration: periodDowntimes.reduce((sum, d) => sum + d.duration, 0),
        ompostingTime: new Date(omposting.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
      });
    });

    return periods;
  };

  const deleteDowntime = (id) => {
    if (confirm('Er du sikker på at du vil slette denne stanseregistreringen?')) {
      const updatedHistory = downtimeHistory.filter(d => d.id !== id);
      setDowntimeHistory(updatedHistory);
      saveHistory(updatedHistory);
    }
  };

  const formatDuration = (startTime) => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getFilteredHistory = () => {
    if (!dateFilter.from && !dateFilter.to) return downtimeHistory;
    return downtimeHistory.filter(d => {
      if (dateFilter.from && d.date < dateFilter.from) return false;
      if (dateFilter.to && d.date > dateFilter.to) return false;
      return true;
    });
  };

  const getStats = () => {
    const filtered = getFilteredHistory();
    const totalDowntime = filtered.reduce((sum, d) => sum + d.duration, 0);
    const byMachine = {};
    const byDate = {};
    
    filtered.forEach(d => {
      byMachine[d.machineName] = (byMachine[d.machineName] || 0) + d.duration;
      byDate[d.date] = (byDate[d.date] || 0) + d.duration;
    });

    return { totalDowntime, byMachine, byDate, count: filtered.length };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Laster...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Stansetidssystem</h1>
            <p className="text-gray-600 mt-2">Sagbruk - Produksjonsovervåking</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brukernavn
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="operatør eller sjef"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passord
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Logg inn
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p className="font-semibold mb-2">Testdata:</p>
            <p>Operatør: operatør / operator123</p>
            <p>Sjef: sjef / sjef123</p>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'operator') {
    const todayDowntimes = downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Operatørpanel</h1>
                <p className="text-gray-600">Hei, {user.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logg ut
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setView('main')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  view === 'main' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Play className="w-4 h-4" />
                Registrer stans
              </button>
              <button
                onClick={() => setView('today')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  view === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Eye className="w-4 h-4" />
                I dag ({todayDowntimes.length})
              </button>
              <button
                onClick={() => setView('posts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  view === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Post rapport
              </button>
            </div>
          </div>

          {view === 'main' && (
            <>
              {activeDowntimes.length > 0 && (
                <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-6 mb-6">
                  <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    Aktive stanser
                  </h2>
                  <div className="space-y-3">
                    {activeDowntimes.map(downtime => (
                      <div key={downtime.id} className="bg-white rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-800">{downtime.machineName}</p>
                          <p className="text-sm text-gray-600">
                            Start: {new Date(downtime.startTime).toLocaleTimeString('nb-NO')}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-red-600 tabular-nums">
                            {formatDuration(downtime.startTime)}
                          </div>
                          <button
                            onClick={() => stopDowntime(downtime)}
                            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold"
                          >
                            <Pause className="w-5 h-5" />
                            STOPP
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MACHINES.map(machine => {
                  const isActive = activeDowntimes.some(d => d.machineId === machine.id);
                  return (
                    <button
                      key={machine.id}
                      onClick={() => !isActive && startDowntime(machine)}
                      disabled={isActive}
                      className={`${machine.color} ${
                        isActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                      } text-white rounded-xl p-4 transition-all shadow-lg`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Play className="w-8 h-8" />
                        <span className="font-bold text-sm text-center leading-tight">{machine.name}</span>
                        {isActive && (
                          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                            Pågår...
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'today' && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Registrerte stanser i dag - {new Date().toLocaleDateString('nb-NO')}
              </h2>
              
              {todayDowntimes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Ingen stanser registrert i dag</p>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700">
                      Total stansetid i dag: <span className="text-2xl text-blue-600">{todayDowntimes.reduce((sum, d) => sum + d.duration, 0)} minutter</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    {todayDowntimes.map(d => (
                      <div key={d.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-800">{d.machineName}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <Clock className="w-4 h-4 inline mr-1" />
                              {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} - 
                              {new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-red-600">{d.duration} min</p>
                          </div>
                        </div>
                        
                        <div className="bg-gray-100 rounded-lg p-3 mb-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Årsak:</p>
                          <p className="text-sm text-gray-800">{d.comment}</p>
                          {d.postNumber && (
                            <p className="text-sm text-gray-800 mt-2">
                              <span className="font-semibold">Post Nr:</span> {d.postNumber}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEditModal(d)}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Rediger
                          </button>
                          <button
                            onClick={() => deleteDowntime(d.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Slett
                          </button>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                          Registrert av: {d.operatorName}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {view === 'posts' && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Stansetid per Post - {new Date().toLocaleDateString('nb-NO')}
              </h2>
              
              <div className="space-y-4">
                {getPostingStats().map((period, idx) => (
                  <div key={idx} className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{period.postNumber}</h3>
                        {period.ompostingTime && (
                          <p className="text-sm text-gray-600">Omposting kl: {period.ompostingTime}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-red-600">{period.totalDuration} min</p>
                        <p className="text-xs text-gray-600">Total stansetid</p>
                      </div>
                    </div>

                    {period.downtimes.length > 0 ? (
                      <div className="space-y-2 mt-3">
                        {period.downtimes.map(d => (
                          <div key={d.id} className="bg-white rounded-lg p-3 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-800">{d.machineName}</span>
                              <span className="font-bold text-red-600">{d.duration} min</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{d.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Ingen stanser i denne perioden</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                <p className="text-sm font-semibold text-gray-700">
                  💡 <span className="font-bold">Tips:</span> Denne rapporten viser stansetid mellom ompostinger. 
                  Bruk dette til å rapportere i Excel. Stansetiden summeres fra en omposting til neste, 
                  eller fra omposting til slutt av dagen.
                </p>
              </div>
            </div>
          )}
        </div>

        {commentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Avslutt stans: {commentModal.machineName}
              </h2>
              <p className="text-gray-600 mb-4">
                Varighet: <span className="font-bold">{Math.floor((Date.now() - commentModal.startTime) / 1000 / 60)} minutter</span>
              </p>
              
              {commentModal.machineName === 'Omposting/Korigering' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Nr *
                  </label>
                  <input
                    type="text"
                    value={postNumber}
                    onChange={(e) => setPostNumber(e.target.value)}
                    placeholder="F.eks. 1, 2, 3..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Beskriv årsaken til stansen..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 h-32 resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCommentModal(null);
                    setComment('');
                    setPostNumber('');
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmStop}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Lagre
                </button>
              </div>
            </div>
          </div>
        )}

        {editModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Rediger stans: {editModal.machineName}
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Varighet (minutter)
                </label>
                <input
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>

              {editModal.machineName === 'Omposting/Korigering' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Nr *
                  </label>
                  <input
                    type="text"
                    value={editPostNumber}
                    onChange={(e) => setEditPostNumber(e.target.value)}
                    placeholder="F.eks. 1, 2, 3..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Årsak
                </label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Beskriv årsaken til stansen..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditModal(null);
                    setEditComment('');
                    setEditDuration('');
                    setEditPostNumber('');
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Lagre endringer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const stats = getStats();
  const filtered = getFilteredHistory();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Lederpanel</h1>
              <p className="text-gray-600">Hei, {user.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logg ut
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setView('main')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                view === 'main' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Oversikt
            </button>
            <button
              onClick={() => setView('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                view === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Historikk
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                view === 'analytics' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analyse
            </button>
          </div>
        </div>

        {view === 'main' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total stansetid</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalDowntime} min</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Antall stanser</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.count}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gjennomsnitt</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {stats.count > 0 ? Math.round(stats.totalDowntime / stats.count) : 0} min
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Siste stanser (i dag)</h2>
              <div className="space-y-2">
                {downtimeHistory
                  .filter(d => d.date === new Date().toISOString().split('T')[0])
                  .slice(0, 10)
                  .map(d => (
                    <div key={d.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{d.machineName}</p>
                        <p className="text-sm text-gray-600">{d.comment}</p>
                        {d.postNumber && (
                          <p className="text-sm text-blue-600 font-medium mt-1">Post Nr: {d.postNumber}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(d.startTime).toLocaleTimeString('nb-NO')} - Operatør: {d.operatorName}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-red-600">{d.duration} min</p>
                      </div>
                    </div>
                  ))}
                {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen stanser i dag</p>
                )}
              </div>
            </div>
          </>
        )}

        {view === 'history' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-bold text-gray-800">Stansehistorikk</h2>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => setDateFilter({...dateFilter, from: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => setDateFilter({...dateFilter, to: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => setDateFilter({from: '', to: ''})}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                >
                  Tøm
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Dato</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Maskin</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Varighet</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Årsak</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Operatør</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">{d.date}</td>
                      <td className="p-3 text-sm font-medium">
                        {d.machineName}
                        {d.postNumber && <span className="text-blue-600 ml-2">(Post {d.postNumber})</span>}
                      </td>
                      <td className="p-3 text-sm font-bold text-red-600">{d.duration} min</td>
                      <td className="p-3 text-sm">{d.comment}</td>
                      <td className="p-3 text-sm">{d.operatorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center text-gray-500 py-8">Ingen data å vise</p>
              )}
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Stanser per maskin</h2>
                <div className="space-y-3">
                  {Object.entries(stats.byMachine)
                    .sort((a, b) => b[1] - a[1])
                    .map(([machine, duration]) => (
                      <div key={machine}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">{machine}</span>
                          <span className="text-sm font-bold text-gray-800">{duration} min</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${(duration / stats.totalDowntime) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  {Object.keys(stats.byMachine).length === 0 && (
                    <p className="text-center text-gray-500 py-8">Ingen data</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Stanser per dag</h2>
                <div className="space-y-3">
                  {Object.entries(stats.byDate)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 10)
                    .map(([date, duration]) => (
                      <div key={date}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">{date}</span>
                          <span className="text-sm font-bold text-gray-800">{duration} min</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${(duration / Math.max(...Object.values(stats.byDate))) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  {Object.keys(stats.byDate).length === 0 && (
                    <p className="text-center text-gray-500 py-8">Ingen data</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Vanligste årsaker</h2>
              <div className="space-y-2">
                {(() => {
                  const causes = {};
                  filtered.forEach(d => {
                    causes[d.comment] = (causes[d.comment] || 0) + 1;
                  });
                  return Object.entries(causes)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([cause, count]) => (
                      <div key={cause} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{cause}</span>
                        <span className="text-sm font-bold text-gray-800">{count}x</span>
                      </div>
                    ));
                })()}
                {filtered.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}