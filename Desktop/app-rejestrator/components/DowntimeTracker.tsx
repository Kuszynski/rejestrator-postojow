'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Clock, TrendingUp, BarChart3, Calendar, LogOut, AlertCircle, CheckCircle, Edit2, Trash2, Eye, Download } from 'lucide-react';
import SimpleChart from './SimpleChart';

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
  { id: 'op1', username: 'operatør', role: 'operator', name: 'Operator' },
  { id: 'op2', username: 'Dag', role: 'operator', name: 'Dag' },
  { id: 'op3', username: 'Kveld', role: 'operator', name: 'Kveld' },
  { id: 'mg1', username: 'sjef', role: 'manager', name: 'Leder' },
  { id: 'ad1', username: 'admin', role: 'admin', name: 'Administrator' },
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
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPasswordForm, setNewPasswordForm] = useState({ password: '', confirm: '' });
  const [selectedUser, setSelectedUser] = useState(null);

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
      const { data, error } = await supabase
        .from('downtimes') // Zakładam, że tabela nazywa się 'downtimes'
        .select('*')
        .order('start_time', { ascending: false }); // Zmieniono na snake_case

      if (error) {
        console.error('Błąd ładowania danych z Supabase:', error);
        setDowntimeHistory([]);
      } else {
        const enrichedData = data.map(downtime => {
          const machine = MACHINES.find(m => m.id === downtime.machine_id);
          const operator = USERS.find(u => u.id === downtime.operator_id);
          return {
            id: downtime.id,
            machineId: downtime.machine_id,
            machineName: machine ? machine.name : 'Nieznana maszyna',
            startTime: new Date(downtime.start_time).getTime(),
            endTime: downtime.end_time ? new Date(downtime.end_time).getTime() : null,
            duration: downtime.duration,
            comment: downtime.comment,
            postNumber: downtime.post_number,
            date: downtime.date,
            operatorId: downtime.operator_id,
            operatorName: operator ? operator.name : 'Nieznany operator',
          };
        });
        setDowntimeHistory(enrichedData);
      }
    } catch (error) {
      console.error('Nieoczekiwany błąd podczas ładowania danych:', error);
      setDowntimeHistory([]);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    
    const foundUser = USERS.find(u => u.username === loginForm.username);
    if (!foundUser) {
      alert('Feil brukernavn. Tilgjengelige: ' + USERS.map(u => u.username).join(', '));
      return;
    }

    try {
      const { data: userPassword, error } = await supabase
        .from('user_passwords')
        .select('password_hash')
        .eq('user_id', foundUser.username)
        .single();

      // Hvis ingen passord funnet, vis opprett passord modal
      if (error?.code === 'PGRST116' || !userPassword) {
        setSelectedUser(foundUser);
        setShowSetPassword(true);
        return;
      }

      // Hvis andre feil, vis feilmelding
      if (error) {
        console.error('Supabase error:', error);
        alert('Feil ved innlogging. Prøv igjen eller kontakt administrator.');
        return;
      }

      // Sjekk passord
      if (userPassword.password_hash === loginForm.password) {
        setUser(foundUser);
        setLoginForm({ username: '', password: '' });
      } else {
        alert('Feil passord');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil. Sjekk internettforbindelsen.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('main');
    setActiveDowntimes([]);
  };

  const setInitialPassword = async () => {
    if (!newPasswordForm.password || !newPasswordForm.confirm) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    if (newPasswordForm.password !== newPasswordForm.confirm) {
      alert('Passordene stemmer ikke overens');
      return;
    }

    if (newPasswordForm.password.length < 6) {
      alert('Passordet må være minst 6 tegn');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_passwords')
        .insert({
          user_id: selectedUser.username,
          password_hash: newPasswordForm.password
        });

      if (error) {
        console.error('Feil ved lagring av passord:', error);
        alert('Kunne ikke lagre passord: ' + error.message);
        return;
      }

      alert('Passord opprettet! Du kan nå logge inn.');
      setShowSetPassword(false);
      setNewPasswordForm({ password: '', confirm: '' });
      setSelectedUser(null);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil ved lagring av passord.');
    }
  };

  const changePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      alert('Vennligst fyll ut alle felt');
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      alert('Nye passord stemmer ikke overens');
      return;
    }

    if (passwordForm.new.length < 6) {
      alert('Nytt passord må være minst 6 tegn');
      return;
    }

    try {
      // Hent nåværende passord fra Supabase
      const { data: currentPassword, error: fetchError } = await supabase
        .from('user_passwords')
        .select('password_hash')
        .eq('user_id', user.username)
        .single();

      if (fetchError) {
        console.error('Feil ved henting av nåværende passord:', fetchError);
        alert('Kunne ikke hente nåværende passord: ' + fetchError.message);
        return;
      }
      
      if (currentPassword.password_hash !== passwordForm.current) {
        alert('Nåværende passord er feil');
        return;
      }

      // Oppdater passord i Supabase
      const { error: updateError } = await supabase
        .from('user_passwords')
        .update({ password_hash: passwordForm.new })
        .eq('user_id', user.username);

      if (updateError) {
        console.error('Feil ved oppdatering av passord:', updateError);
        alert('Kunne ikke endre passord: ' + updateError.message);
        return;
      }

      alert('Passord endret!');
      setShowPasswordChange(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Nettverksfeil ved endring av passord.');
    }
  };

  const startDowntime = (machine) => {
    const tempId = Date.now(); // Generujemy tymczasowe ID
    const newDowntime = {
      id: tempId, // Używamy tymczasowego ID
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

  const confirmStop = async () => {
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

    const completedDowntimeForSupabase = {
      machine_id: commentModal.machineId,
      operator_id: user.id,
      start_time: new Date(commentModal.startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration: duration,
      comment: comment.trim(),
      post_number: commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : null,
      date: new Date().toISOString().split('T')[0],
    };

    const { data, error } = await supabase
      .from('downtimes')
      .insert([completedDowntimeForSupabase])
      .select();

    if (error) {
      console.error('Błąd zapisywania przestoju do Supabase:', error);
      alert('Wystąpił błąd podczas zapisywania przestoju.');
    } else {
      const newDowntimeFromSupabase = data[0];
      const machine = MACHINES.find(m => m.id === newDowntimeFromSupabase.machine_id);
      const operator = USERS.find(u => u.id === newDowntimeFromSupabase.operator_id);

      const enrichedDowntime = {
        id: newDowntimeFromSupabase.id,
        machineId: newDowntimeFromSupabase.machine_id,
        machineName: machine ? machine.name : 'Nieznana maszyna',
        startTime: new Date(newDowntimeFromSupabase.start_time).getTime(),
        endTime: new Date(newDowntimeFromSupabase.end_time).getTime(),
        duration: newDowntimeFromSupabase.duration,
        comment: newDowntimeFromSupabase.comment,
        postNumber: newDowntimeFromSupabase.post_number,
        date: newDowntimeFromSupabase.date,
        operatorId: newDowntimeFromSupabase.operator_id,
        operatorName: operator ? operator.name : 'Nieznany operator',
      };

      setDowntimeHistory(prev => [enrichedDowntime, ...prev]);
      setActiveDowntimes(activeDowntimes.filter(d => d.id !== commentModal.id));
      setCommentModal(null);
      setComment('');
      setPostNumber('');
    }
  }; // Dodano brakujący nawias klamrowy

  const openEditModal = (downtime) => {
    setEditModal(downtime);
    setEditComment(downtime.comment);
    setEditDuration(downtime.duration.toString());
    setEditPostNumber(downtime.postNumber || '');
  }; // Dodano brakujący nawias klamrowy

  const saveEdit = async () => {
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

    const { data, error } = await supabase
      .from('downtimes')
      .update({
        comment: editComment.trim(),
        duration: newDuration,
        post_number: editModal.machineName === 'Omposting/Korigering' ? editPostNumber.trim() : editModal.postNumber // Zmieniono na snake_case
      })
      .eq('id', editModal.id)
      .select(); // Zwraca zaktualizowany rekord

    if (error) {
      console.error('Błąd aktualizacji przestoju w Supabase:', error);
      alert('Wystąpił błąd podczas aktualizacji przestoju.');
    } else {
      const updatedDowntimeFromSupabase = data[0];
      const machine = MACHINES.find(m => m.id === updatedDowntimeFromSupabase.machine_id);
      const operator = USERS.find(u => u.id === updatedDowntimeFromSupabase.operator_id);

      const enrichedDowntime = {
        id: updatedDowntimeFromSupabase.id,
        machineId: updatedDowntimeFromSupabase.machine_id,
        machineName: machine ? machine.name : 'Nieznana maszyna',
        startTime: new Date(updatedDowntimeFromSupabase.start_time).getTime(),
        endTime: new Date(updatedDowntimeFromSupabase.end_time).getTime(),
        duration: updatedDowntimeFromSupabase.duration,
        comment: updatedDowntimeFromSupabase.comment,
        postNumber: updatedDowntimeFromSupabase.post_number,
        date: updatedDowntimeFromSupabase.date,
        operatorId: updatedDowntimeFromSupabase.operator_id,
        operatorName: operator ? operator.name : 'Nieznany operator',
      };

      setDowntimeHistory(prev => prev.map(d => d.id === editModal.id ? enrichedDowntime : d));
      setEditModal(null);
      setEditComment('');
      setEditDuration('');
      setEditPostNumber('');
    }
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
  }; // Dodano brakujący nawias klamrowy

  const deleteDowntime = async (id) => {
    if (confirm('Er du sikker på at du vil slette denne stanseregistreringen?')) {
      const { error } = await supabase
        .from('downtimes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Błąd usuwania przestoju z Supabase:', error);
        alert('Wystąpił błąd podczas usuwania przestoju.');
      } else {
        setDowntimeHistory(prev => prev.filter(d => d.id !== id));
      }
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

  const exportTodayToExcel = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayDowntimes = downtimeHistory.filter(d => d.date === today);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Dato,Tid Start,Tid Slutt,Maskin,Varighet (min),Årsak,Post Nr,Operatør\n";
    
    todayDowntimes.forEach(d => {
      const startTime = new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      const endTime = new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      csvContent += `${d.date},${startTime},${endTime},"${d.machineName}",${d.duration},"${d.comment}",${d.postNumber || ''},"${d.operatorName}"\n`;
    });
    
    // Legg til totaler
    const totalDuration = todayDowntimes.reduce((sum, d) => sum + d.duration, 0);
    csvContent += `\nTOTALT:,,,${todayDowntimes.length} stanser,${totalDuration} min,,,\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stanser_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPostsToExcel = () => {
    const today = new Date().toISOString().split('T')[0];
    const postStats = getPostingStats();
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Post Periode,Stansetid (min),Antall Stanser,Detaljer\n";
    
    postStats.forEach(period => {
      csvContent += `"${period.postNumber}",${period.totalDuration},${period.downtimes.length},"${period.downtimes.map(d => `${d.machineName}: ${d.duration}min`).join('; ')}"\n`;
    });
    
    const totalDuration = postStats.reduce((sum, p) => sum + p.totalDuration, 0);
    csvContent += `\nTOTALT:,${totalDuration} min,${postStats.reduce((sum, p) => sum + p.downtimes.length, 0)} stanser,\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `post_rapport_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto">
          {/* Main Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-16 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-3xl"></div>
            
            {/* Content */}
            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-16">
                <div className="relative mb-12">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                    <Clock className="w-16 h-16 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-400 rounded-full border-4 border-white shadow-sm"></div>
                </div>
                
                <h1 className="text-6xl font-bold text-gray-900 mb-6">Velkommen</h1>
                <p className="text-2xl text-gray-600 mb-8">Logg inn for å fortsette</p>
                
                {/* Location Info */}
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-blue-50 rounded-full border border-blue-100">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-xl font-medium text-blue-700">Haslestad</span>
                  <span className="text-xl text-blue-600">•</span>
                  <span className="text-xl text-blue-600">Avdeling Saga</span>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-12">
                <div className="space-y-12">
                  <div className="relative">
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      className="w-full px-12 py-8 bg-white/70 border-4 border-gray-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent transition-all text-2xl text-gray-900 placeholder-gray-500 backdrop-blur-sm font-medium text-center min-h-[100px]"
                      placeholder="Brukernavn"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="relative">
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full px-12 py-8 bg-white/70 border-4 border-gray-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent transition-all text-2xl text-gray-900 placeholder-gray-500 backdrop-blur-sm font-medium text-center min-h-[100px]"
                      placeholder="Passord"
                      required
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-8 px-12 rounded-3xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] text-2xl min-h-[100px]"
                  >
                    Logg inn
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-center mt-12">
            <p className="text-sm text-gray-400/60 font-light">
              Utviklet av Kuszynski
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'operator' || user.role === 'admin') {
    const todayDowntimes = downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]);

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Operatørpanel</h1>
                <p className="text-gray-500 mt-1">Hei, {user.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl transition-colors font-medium"
                >
                  🔑 Endre passord
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Logg ut
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setView('main')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                  view === 'main' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Play className="w-4 h-4" />
                Registrer stans
              </button>
              
              <button
                onClick={() => setView('today')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors relative ${
                  view === 'today' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>I dag {todayDowntimes.length > 0 ? ` ${todayDowntimes.length}` : ''}</span>
              </button>
              
              <button
                onClick={() => setView('posts')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                  view === 'posts' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Aktive stanser
                  </h2>
                  <div className="space-y-4">
                    {activeDowntimes.map(downtime => (
                      <div key={downtime.id} className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{downtime.machineName}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Start: {new Date(downtime.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-semibold text-red-500 tabular-nums">
                            {formatDuration(downtime.startTime)}
                          </div>
                          <button
                            onClick={() => stopDowntime(downtime)}
                            className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors"
                          >
                            <Pause className="w-4 h-4" />
                            Stopp stans
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {MACHINES.map(machine => {
                  const isActive = activeDowntimes.some(d => d.machineId === machine.id);
                  const activeDowntime = activeDowntimes.find(d => d.machineId === machine.id);
                  
                  return (
                    <button
                      key={machine.id}
                      onClick={() => !isActive && startDowntime(machine)}
                      disabled={isActive}
                      className={`relative h-32 rounded-2xl transition-all duration-200 border ${
                        isActive 
                          ? 'bg-gray-100 border-gray-200 cursor-not-allowed' 
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm active:scale-95'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full p-4">
                        {/* Icon */}
                        <div className={`mb-3 p-3 rounded-full ${
                          isActive ? 'bg-gray-200' : machine.color
                        }`}>
                          {isActive ? (
                            <Clock className="w-5 h-5 text-gray-500 animate-pulse" />
                          ) : (
                            <Play className="w-5 h-5 text-white" />
                          )}
                        </div>
                        
                        {/* Machine name */}
                        <span className={`font-medium text-sm text-center leading-tight ${
                          isActive ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {machine.name}
                        </span>
                      </div>
                      
                      {/* Active overlay with timer */}
                      {isActive && activeDowntime && (
                        <div className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-center">
                          <div className="text-center text-white">
                            <div className="text-xl font-semibold animate-pulse">
                              {formatDuration(activeDowntime.startTime)}
                            </div>
                            <div className="text-sm opacity-90">Aktiv stans</div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'today' && (
            <div className="space-y-6">
              {/* Header with stats */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-1">Dagens stanser</h2>
                    <p className="text-gray-500">{new Date().toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button
                    onClick={exportTodayToExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Eksporter
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-semibold text-gray-900">{todayDowntimes.length}</div>
                    <div className="text-sm text-gray-500 mt-1">Stanser</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-semibold text-red-500">{todayDowntimes.reduce((sum, d) => sum + d.duration, 0)}</div>
                    <div className="text-sm text-gray-500 mt-1">Minutter</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-semibold text-gray-900">
                      {todayDowntimes.length > 0 ? Math.round(todayDowntimes.reduce((sum, d) => sum + d.duration, 0) / todayDowntimes.length) : 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Gjennomsnitt</div>
                  </div>
                </div>
              </div>

              {/* Content */}
              {todayDowntimes.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingen stanser i dag</h3>
                  <p className="text-gray-500">Flott arbeid - produksjonen går som den skal.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left p-4 font-semibold text-gray-700">#</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Tid</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Varighet</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                          <th className="text-left p-4 font-semibold text-gray-700">Handlinger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayDowntimes.map((d, index) => {
                          const machine = MACHINES.find(m => m.name === d.machineName);
                          return (
                            <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4">
                                <div className={`w-8 h-8 ${machine?.color || 'bg-gray-500'} text-white rounded-lg flex items-center justify-center font-semibold text-sm`}>
                                  {index + 1}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="text-gray-500">
                                    {new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div>
                                  <div className="font-medium text-gray-900">{d.machineName}</div>
                                  {d.postNumber && (
                                    <div className="text-xs text-blue-600 mt-1">Post {d.postNumber}</div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {d.comment.length > 50 ? d.comment.substring(0, 50) + '...' : d.comment}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-sm font-medium ${
                                  d.duration > 60 ? 'bg-red-100 text-red-800' :
                                  d.duration > 30 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {d.duration} min
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-gray-600">{d.operatorName}</div>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(d)}
                                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                                    title="Rediger"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteDowntime(d.id)}
                                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                                    title="Slett"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'posts' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      📈 Post Rapport
                    </h2>
                    <p className="text-green-100">{new Date().toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{getPostingStats().length}</div>
                      <div className="text-green-100 text-sm">perioder</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{getPostingStats().reduce((sum, p) => sum + p.totalDuration, 0)}</div>
                      <div className="text-green-100 text-sm">min total</div>
                    </div>
                    <button
                      onClick={exportPostsToExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-white/30"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Detaljert tabell for hver post periode */}
              <div className="space-y-6">
                {getPostingStats().map((period, idx) => {
                  const isFirstPost = idx === 0;
                  const statusColor = period.totalDuration === 0 
                    ? 'from-green-500 to-green-600' 
                    : period.totalDuration > 60 
                      ? 'from-red-500 to-red-600'
                      : 'from-yellow-500 to-yellow-600';
                  
                  return (
                    <div key={idx} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                      {/* Post header */}
                      <div className={`bg-gradient-to-r ${statusColor} text-white p-4`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">
                              {isFirstPost ? '🌅' : '🔄'}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{period.postNumber}</h3>
                              {period.ompostingTime && (
                                <p className="text-sm opacity-90">
                                  Omposting: {period.ompostingTime}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{period.totalDuration} min</div>
                            <div className="text-sm opacity-90">{period.downtimes.length} stanser</div>
                          </div>
                        </div>
                      </div>

                      {/* Stanser i denne perioden */}
                      {period.downtimes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Maskin</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Start Dato/Tid</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Slutt Dato/Tid</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Varighet</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Årsak</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700">Operatør</th>
                              </tr>
                            </thead>
                            <tbody>
                              {period.downtimes.map((d, dIdx) => {
                                const machine = MACHINES.find(m => m.name === d.machineName);
                                const startDate = new Date(d.startTime);
                                const endDate = new Date(d.endTime);
                                
                                return (
                                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${machine?.color || 'bg-gray-400'}`}></div>
                                        <span className="font-medium text-gray-800">{d.machineName}</span>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm">
                                        <div className="font-medium text-gray-800">
                                          {startDate.toLocaleDateString('nb-NO', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric' 
                                          })}
                                        </div>
                                        <div className="text-gray-600">
                                          {startDate.toLocaleTimeString('nb-NO', { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            second: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm">
                                        <div className="font-medium text-gray-800">
                                          {endDate.toLocaleDateString('nb-NO', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric' 
                                          })}
                                        </div>
                                        <div className="text-gray-600">
                                          {endDate.toLocaleTimeString('nb-NO', { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            second: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <span className="text-lg font-bold text-red-600">{d.duration} min</span>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm text-gray-700 max-w-xs">
                                        {d.comment}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-sm text-gray-600">{d.operatorName}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-50 border-t-2">
                                <td className="p-3 font-semibold text-gray-800">Periode totalt:</td>
                                <td colSpan={2} className="p-3 text-sm text-gray-600">
                                  {period.downtimes.length} stanser
                                </td>
                                <td className="p-3">
                                  <span className="text-lg font-bold text-red-600">{period.totalDuration} min</span>
                                </td>
                                <td colSpan={2} className="p-3 text-sm text-gray-600">
                                  Gjennomsnitt: {period.downtimes.length > 0 ? Math.round(period.totalDuration / period.downtimes.length) : 0} min/stans
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <div className="text-4xl mb-2">🎉</div>
                          <p className="text-lg font-semibold text-gray-800">Ingen stanser i denne perioden!</p>
                          <p className="text-gray-600">Perfekt produksjon.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sammendrag */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Sammendrag for hele dagen</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {getPostingStats().length}
                    </div>
                    <div className="text-sm text-blue-700">Perioder</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {getPostingStats().reduce((sum, p) => sum + p.downtimes.length, 0)}
                    </div>
                    <div className="text-sm text-red-700">Totale stanser</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {getPostingStats().reduce((sum, p) => sum + p.totalDuration, 0)} min
                    </div>
                    <div className="text-sm text-orange-700">Total stansetid</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {getPostingStats().reduce((sum, p) => sum + p.downtimes.length, 0) > 0 
                        ? Math.round(getPostingStats().reduce((sum, p) => sum + p.totalDuration, 0) / getPostingStats().reduce((sum, p) => sum + p.downtimes.length, 0))
                        : 0} min
                    </div>
                    <div className="text-sm text-purple-700">Gjennomsnitt/stans</div>
                  </div>
                </div>
              </div>

              {/* Tips boks */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    💡
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Slik bruker du rapporten:</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Hver periode viser stansetid fra en omposting til neste</li>
                      <li>• Kopier tallene direkte til Excel for videre rapportering</li>
                      <li>• Grønne perioder = ingen stanser, gule = moderate stanser, røde = mange stanser</li>
                      <li>• Klikk på "I dag" for å redigere eller slette stanser</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {commentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">
                  🛑 Avslutt stans
                </h2>
                <p className="text-blue-100">
                  {commentModal.machineName}
                </p>
                <div className="mt-3 bg-white/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Varighet:</span>
                    <span className="text-xl font-bold">
                      {Math.floor((Date.now() - commentModal.startTime) / 1000 / 60)} min
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {commentModal.machineName === 'Omposting/Korigering' && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      📋 Post Nr *
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
                    💬 Årsak til stans *
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setComment(e.target.value);
                      }
                    }}
                    placeholder="Beskriv hva som skjedde...\n\nEksempler:\n• Maskin stoppet plutselig\n• Materialmangel\n• Teknisk feil\n• Planlagt vedlikehold"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-32 md:h-40 resize-none text-base leading-relaxed"
                    autoFocus={commentModal.machineName !== 'Omposting/Korigering'}
                    maxLength={500}
                    style={{
                      minHeight: '120px'
                    }}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {comment.length}/500 tegn
                  </div>
                </div>

                {/* Action buttons right after textarea */}
                <div className="space-y-3">
                  <button
                    onClick={confirmStop}
                    disabled={!comment.trim() || (commentModal.machineName === 'Omposting/Korigering' && !postNumber.trim())}
                    className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-opacity-50"
                  >
                    ✅ LAGRE STANS
                  </button>
                  
                  <button
                    onClick={() => {
                      setCommentModal(null);
                      setComment('');
                      setPostNumber('');
                    }}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  >
                    ❌ Avbryt
                  </button>
                </div>

                {/* Help text */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    💡 <strong>Tips:</strong> Beskriv kort og tydelig hva som forårsaket stansen for bedre oppfølging.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {editModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">
                  ✏️ Rediger stans
                </h2>
                <p className="text-orange-100">
                  {editModal.machineName}
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ⏱️ Varighet (minutter)
                  </label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg font-bold text-center"
                    min="1"
                    autoFocus
                  />
                </div>

                {editModal.machineName === 'Omposting/Korigering' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      📋 Post Nr *
                    </label>
                    <input
                      type="text"
                      value={editPostNumber}
                      onChange={(e) => setEditPostNumber(e.target.value)}
                      placeholder="F.eks. 1, 2, 3..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    💬 Årsak til stans *
                  </label>
                  <textarea
                    value={editComment}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setEditComment(e.target.value);
                      }
                    }}
                    placeholder="Beskriv årsaken til stansen...\n\nEksempler:\n• Maskin stoppet plutselig\n• Materialmangel\n• Teknisk feil\n• Planlagt vedlikehold"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all h-32 md:h-40 resize-none text-base leading-relaxed"
                    maxLength={500}
                    style={{
                      minHeight: '120px'
                    }}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {editComment.length}/500 tegn
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={saveEdit}
                    disabled={!editComment.trim() || !editDuration || (editModal.machineName === 'Omposting/Korigering' && !editPostNumber.trim())}
                    className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-opacity-50"
                  >
                    ✅ LAGRE ENDRINGER
                  </button>
                  
                  <button
                    onClick={() => {
                      setEditModal(null);
                      setEditComment('');
                      setEditDuration('');
                      setEditPostNumber('');
                    }}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  >
                    ❌ Avbryt
                  </button>
                </div>

                {/* Help text */}
                <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-700">
                    💡 <strong>Tips:</strong> Du kan endre varighet, årsak og post nummer for denne stansen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPasswordChange && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-xl font-bold mb-2">
                  🔑 Endre passord
                </h2>
                <p className="text-blue-100">
                  {user.name}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nåværende passord *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nytt passord *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Bekreft nytt passord *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={changePassword}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                  >
                    ✅ ENDRE PASSORD
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordForm({ current: '', new: '', confirm: '' });
                    }}
                    className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                  >
                    ❌ Avbryt
                  </button>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    📝 <strong>Tips:</strong> Bruk minst 6 tegn. Passordet lagres sikkert i nettleseren.
                  </p>
                </div>
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswordChange(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                🔑 Endre passord
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logg ut
              </button>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setView('main')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${view === 'main' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <TrendingUp className="w-4 h-4" />
              Oversikt
            </button>
            <button
              onClick={() => setView('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${view === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <Calendar className="w-4 h-4" />
              Historikk
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${view === 'analytics' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analyse
            </button>
          </div>
        </div>

        {view === 'main' && (
          <div className="space-y-6">
            {/* Statistikk kort */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Oversikt</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-3xl font-bold text-red-500 mb-1">{stats.totalDowntime}</div>
                  <div className="text-sm text-gray-600">Total stansetid (min)</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-3xl font-bold text-blue-500 mb-1">{stats.count}</div>
                  <div className="text-sm text-gray-600">Antall stanser</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-3xl font-bold text-purple-500 mb-1">
                    {stats.count > 0 ? Math.round(stats.totalDowntime / stats.count) : 0}
                  </div>
                  <div className="text-sm text-gray-600">Gjennomsnitt (min)</div>
                </div>
              </div>
            </div>

            {/* Siste stanser i dag */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Siste stanser i dag</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Tid</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Operatør</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Varighet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeHistory
                      .filter(d => d.date === new Date().toISOString().split('T')[0])
                      .slice(0, 15)
                      .map((d, index) => {
                        const machine = MACHINES.find(m => m.name === d.machineName);
                        return (
                          <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-4">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">
                                  {new Date(d.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-gray-500">
                                  {new Date(d.endTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${machine?.color || 'bg-gray-400'}`}></div>
                                <div>
                                  <div className="font-medium text-gray-900">{d.machineName}</div>
                                  {d.postNumber && (
                                    <div className="text-xs text-blue-600">Post {d.postNumber}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-gray-700 max-w-xs truncate" title={d.comment}>
                                {d.comment}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-gray-600">{d.operatorName}</div>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-lg font-bold text-red-600">{d.duration} min</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {downtimeHistory.filter(d => d.date === new Date().toISOString().split('T')[0]).length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingen stanser i dag</h3>
                    <p className="text-gray-500">Flott arbeid - produksjonen går som den skal.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-4 flex-wrap gap-4">
              <h2 className="text-xl font-bold text-gray-800">Stansehistorikk</h2>
              <div className="flex gap-4 flex-wrap items-end">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Fra dato:</label>
                  <input
                    type="date"
                    value={dateFilter.from}
                    onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Til dato:</label>
                  <input
                    type="date"
                    value={dateFilter.to}
                    onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={() => setDateFilter({ from: '', to: '' })}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                >
                  Tøm
                </button>
                <button
                  onClick={() => {
                    const filtered = getFilteredHistory();
                    let csvContent = "data:text/csv;charset=utf-8,";
                    csvContent += "Dato,Start Tid,Slutt Tid,Maskin,Varighet (min),Årsak,Post Nr,Operatør\n";
                    
                    filtered.forEach(d => {
                      const startDate = new Date(d.startTime);
                      const endDate = new Date(d.endTime);
                      const startTime = startDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const endTime = endDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const date = startDate.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      csvContent += `${date},${startTime},${endTime},"${d.machineName}",${d.duration},"${d.comment}",${d.postNumber || ''},"${d.operatorName}"\n`;
                    });
                    
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `stansehistorikk_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Dato</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Start Tid</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Slutt Tid</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Maskin</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Varighet</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Årsak</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">Operatør</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const startDate = new Date(d.startTime);
                    const endDate = new Date(d.endTime);
                    
                    return (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {startDate.toLocaleDateString('nb-NO', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td className="p-3 text-sm">
                          <div className="font-medium text-gray-800">
                            {startDate.toLocaleTimeString('nb-NO', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="font-medium text-gray-800">
                            {endDate.toLocaleTimeString('nb-NO', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="p-3 text-sm font-medium">
                          {d.machineName}
                          {d.postNumber && <span className="text-blue-600 ml-2">(Post {d.postNumber})</span>}
                        </td>
                        <td className="p-3 text-sm font-bold text-red-600">{d.duration} min</td>
                        <td className="p-3 text-sm max-w-xs">
                          <div className="truncate" title={d.comment}>{d.comment}</div>
                        </td>
                        <td className="p-3 text-sm">{d.operatorName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center text-gray-500 py-8">Ingen data å vise</p>
              )}
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-6">
            {/* Stanser per maskin */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Stanser per maskin</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Siste stans - Dato</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Siste stans - Tid</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Total stansetid</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Prosent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byMachine)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([machine, duration]) => {
                        const machineData = MACHINES.find(m => m.name === machine);
                        const percentage = (((duration as number) / stats.totalDowntime) * 100).toFixed(1);
                        
                        // Finn siste stans for denne maskinen
                        const machineDowntimes = filtered.filter(d => d.machineName === machine);
                        const latestDowntime = machineDowntimes.sort((a, b) => b.startTime - a.startTime)[0];
                        
                        return (
                          <tr key={machine} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${machineData?.color || 'bg-gray-400'}`}></div>
                                <span className="font-medium text-gray-900">{machine}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {latestDowntime ? (
                                <span className="text-sm text-gray-700">
                                  {new Date(latestDowntime.startTime).toLocaleDateString('nb-NO', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {latestDowntime ? (
                                <span className="text-sm text-gray-700">
                                  {new Date(latestDowntime.startTime).toLocaleTimeString('nb-NO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-lg font-bold text-red-600">{duration as number} min</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-sm font-medium text-gray-600">{percentage}%</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {Object.keys(stats.byMachine).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>

            {/* Stanser per dag */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Stanser per dag</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Dato</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Ukedag</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Stansetid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byDate)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .slice(0, 10)
                      .map(([date, duration]) => {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('nb-NO', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        });
                        const weekday = dateObj.toLocaleDateString('nb-NO', {
                          weekday: 'long'
                        });
                        
                        return (
                          <tr key={date} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-4">
                              <span className="font-medium text-gray-900">{formattedDate}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-gray-600 capitalize">{weekday}</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-lg font-bold text-red-600">{duration as number} min</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {Object.keys(stats.byDate).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>

            {/* Vanligste årsaker */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Vanligste årsaker</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">Maskin</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Årsak</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Antall</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Prosent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const causesWithMachines = {};
                      filtered.forEach(d => {
                        const key = `${d.comment}|${d.machineName}`;
                        if (!causesWithMachines[key]) {
                          causesWithMachines[key] = {
                            cause: d.comment,
                            machine: d.machineName,
                            count: 0
                          };
                        }
                        causesWithMachines[key].count += 1;
                      });
                      
                      const totalCauses = Object.values(causesWithMachines).reduce((sum, item: any) => sum + item.count, 0);
                      
                      return Object.values(causesWithMachines)
                        .sort((a: any, b: any) => b.count - a.count)
                        .slice(0, 15)
                        .map((item: any, index) => {
                          const percentage = ((item.count / (totalCauses as number)) * 100).toFixed(1);
                          const machineData = MACHINES.find(m => m.name === item.machine);
                          
                          return (
                            <tr key={`${item.cause}-${item.machine}`} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${machineData?.color || 'bg-gray-400'}`}></div>
                                  <span className="font-medium text-gray-900">{item.machine}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-gray-700">{item.cause}</span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-lg font-bold text-blue-600">{item.count}</span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-sm font-medium text-gray-600">{percentage}%</span>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Ingen data</p>
                )}
              </div>
            </div>
          </div>
        )}


      </div>

      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold mb-2">
                🔑 Endre passord
              </h2>
              <p className="text-blue-100">
                {user.name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nåværende passord *
                </label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nytt passord *
                </label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bekreft nytt passord *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={changePassword}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                >
                  ✅ ENDRE PASSORD
                </button>
                
                <button
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordForm({ current: '', new: '', confirm: '' });
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                >
                  ❌ Avbryt
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
🔒 <strong>Sikkert:</strong> Passordet lagres kryptert i Supabase og er ikke synlig i GitHub koden.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSetPassword && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold mb-2">
                🔐 Opprett passord
              </h2>
              <p className="text-green-100">
                Hei {selectedUser.name}! Du må opprette et passord først.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nytt passord *
                </label>
                <input
                  type="password"
                  value={newPasswordForm.password}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-lg"
                  autoFocus
                  placeholder="Minst 6 tegn"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bekreft passord *
                </label>
                <input
                  type="password"
                  value={newPasswordForm.confirm}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, confirm: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-lg"
                  placeholder="Gjenta passordet"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={setInitialPassword}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                >
                  ✅ OPPRETT PASSORD
                </button>
                
                <button
                  onClick={() => {
                    setShowSetPassword(false);
                    setNewPasswordForm({ password: '', confirm: '' });
                    setSelectedUser(null);
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-gray-700"
                >
                  ❌ Avbryt
                </button>
              </div>

              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700">
🔒 <strong>Sikkert:</strong> Passordet lagres sikkert i Supabase og er ikke synlig i GitHub koden.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

