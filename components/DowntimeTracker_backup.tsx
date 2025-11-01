'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Clock, TrendingUp, BarChart3, Calendar, LogOut, AlertCircle, CheckCircle, Edit2, Trash2, Eye, Download, Wrench } from 'lucide-react';
import SimpleChart from './SimpleChart';
import MachineManager from './MachineManager';

interface Machine {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
}

interface DowntimeEntry {
  id: any;
  machineId: string;
  machineName: string;
  startTime: number;
  endTime?: number;
  duration: number;
  comment: string;
  postNumber?: string;
  date: string;
  operatorId: string;
  operatorName: string;
}

export default function DowntimeTracker() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeDowntimes, setActiveDowntimes] = useState<DowntimeEntry[]>([]);
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimeEntry[]>([]);
  const [commentModal, setCommentModal] = useState<DowntimeEntry | null>(null);
  const [comment, setComment] = useState('');
  const [view, setView] = useState('main');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [editModal, setEditModal] = useState<DowntimeEntry | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [postNumber, setPostNumber] = useState('');
  const [editPostNumber, setEditPostNumber] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPasswordForm, setNewPasswordForm] = useState({ password: '', confirm: '' });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('main');
  const [currentPostNumber, setCurrentPostNumber] = useState<string>('');
  const [newUser, setNewUser] = useState({ username: '', password: '' });

  useEffect(() => {
    loadMachines();
    loadUsers();
  }, []);

  useEffect(() => {
    if (machines.length > 0 && users.length > 0) {
      loadData();
    }
  }, [machines, users]);

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading machines:', error);
        alert('Feil ved lasting av maskiner: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        setMachines(data);
      } else {
        console.log('Ingen maskiner funnet i databasen');
        setMachines([]);
      }
    } catch (error) {
      console.error('Unexpected error loading machines:', error);
      alert('Nettverksfeil ved lasting av maskiner');
    }
  };

  useEffect(() => {
    if (user?.role === 'operator') {
      const interval = setInterval(() => {
        setActiveDowntimes(prev => [...prev]);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Auto-refresh data for managers and viewers
  useEffect(() => {
    if (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'viewer') {
      const interval = setInterval(() => {
        loadData();
      }, user?.role === 'viewer' ? 5000 : 10000); // Viewers refresh every 5 seconds, managers every 10
      return () => clearInterval(interval);
    }
  }, [user, machines, users]);

  const loadData = async () => {
    console.log('Loading data from Supabase...');
    console.log('Machines available:', machines.length);
    console.log('Users available:', users.length);
    
    try {
      const { data, error } = await supabase
        .from('downtimes')
        .select('*')
        .order('start_time', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Feil ved lasting av data fra Supabase:', error);
        setDowntimeHistory([]);
      } else {
        console.log('Raw data from Supabase:', data);
        const enrichedData = data.map(downtime => {
          const machine = machines.find(m => m.id === downtime.machine_id);
          const operator = users.find(u => u.id === downtime.operator_id);
          console.log(`Processing downtime ${downtime.id}: machine_id=${downtime.machine_id}, found machine:`, machine);
          return {
            id: downtime.id,
            machineId: downtime.machine_id,
            machineName: machine ? machine.name : `Ukjent maskin (${downtime.machine_id})`,
            startTime: new Date(downtime.start_time).getTime(),
            endTime: downtime.end_time ? new Date(downtime.end_time).getTime() : null,
            duration: downtime.duration,
            comment: downtime.comment,
            postNumber: downtime.post_number,
            photoUrl: downtime.photo_url,
            date: downtime.date,
            operatorId: downtime.operator_id,
            operatorName: operator ? operator.name : `Ukjent operator (${downtime.operator_id})`,
          };
        });
        console.log('Enriched data:', enrichedData);
        setDowntimeHistory(enrichedData);
        
        // Znajdź ostatni numer postu z dzisiaj
        const today = new Date().toISOString().split('T')[0];
        const todayOmpostings = enrichedData
          .filter(d => d.date === today && d.machineName === 'Omposting/Korigering' && d.postNumber)
          .sort((a, b) => b.startTime - a.startTime);
        
        if (todayOmpostings.length > 0) {
          console.log('Setting current post number:', todayOmpostings[0].postNumber);
          setCurrentPostNumber(todayOmpostings[0].postNumber);
        } else {
          console.log('No ompostings found for today');
        }
      }
    } catch (error) {
      console.error('Uventet feil ved lasting av data:', error);
      setDowntimeHistory([]);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_passwords')
        .select('user_id');

      if (error) {
        console.error('Feil ved lasting av brukere:', error);
        return;
      }

      const userList = data.map(u => ({
        id: u.user_id,
        username: u.user_id,
        role: u.user_id === 'admin' ? 'admin' : 
              u.user_id === 'sjef' ? 'manager' : 
              u.user_id === 'tv' ? 'viewer' : 'operator',
        name: u.user_id === 'operatør' ? 'Operatør' : 
              u.user_id === 'operator' ? 'Operator' :
              u.user_id === 'Dag' ? 'Dag' :
              u.user_id === 'dag' ? 'Dag' :
              u.user_id === 'Kveld' ? 'Kveld' :
              u.user_id === 'kveld' ? 'Kveld' :
              u.user_id === 'sjef' ? 'Sjef' :
              u.user_id === 'admin' ? 'Admin' :
              u.user_id === 'tv' ? 'TV Monitor' :
              u.user_id.charAt(0).toUpperCase() + u.user_id.slice(1)
      }));
      
      setUsers(userList);
    } catch (error) {
      console.error('Uventet feil ved lasting av brukere:', error);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    
    console.log('Login attempt:', loginForm.username);
    
    const foundUser = users.find(u => u.username === loginForm.username);
    if (!foundUser) {
      alert('Feil brukernavn. Tilgjengelige: ' + users.map(u => u.username).join(', '));
      return;
    }

    console.log('Found user:', foundUser);

    try {
      console.log('Checking password for user ID:', foundUser.id);
      const { data: userPassword, error } = await supabase
        .from('user_passwords')
        .select('password_hash')
        .eq('user_id', foundUser.id)
        .single();

      console.log('Supabase response:', { data: userPassword, error });

      // Hvis ingen passord funnet, vis opprett passord modal
      if (error?.code === 'PGRST116' || !userPassword) {
        console.log('No password found, showing create password modal');
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
      console.log('Checking password:', loginForm.password, 'vs', userPassword.password_hash);
      if (userPassword.password_hash === loginForm.password) {
        console.log('Password correct, logging in');
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
          user_id: selectedUser.id,
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
        .eq('user_id', user.id)
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
        .eq('user_id', user.id);

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
    const tempId = Date.now();
    const newDowntime = {
      id: tempId,
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

    // Jeśli to Omposting/Korigering, ustaw nowy numer postu
    if (commentModal.machineName === 'Omposting/Korigering' && postNumber.trim()) {
      console.log('Setting new current post number:', postNumber.trim());
      setCurrentPostNumber(postNumber.trim());
    }
    
    console.log('Using post number for this downtime:', commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : currentPostNumber);
    
    const completedDowntimeForSupabase = {
      machine_id: commentModal.machineId,
      operator_id: user.id,
      start_time: new Date(commentModal.startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration: duration,
      comment: comment.trim(),
      post_number: commentModal.machineName === 'Omposting/Korigering' ? postNumber.trim() : currentPostNumber || null,
      date: new Date().toISOString().split('T')[0],
    };

    const { data, error } = await supabase
      .from('downtimes')
      .insert([completedDowntimeForSupabase])
      .select();

    if (error) {
      console.error('Feil ved lagring av stans til Supabase:', error);
      alert('Det oppstod en feil ved lagring av stansen.');
    } else {
      const newDowntimeFromSupabase = data[0];
      const machine = machines.find(m => m.id === newDowntimeFromSupabase.machine_id);
      const operator = users.find(u => u.id === newDowntimeFromSupabase.operator_id);

      const enrichedDowntime = {
        id: newDowntimeFromSupabase.id,
        machineId: newDowntimeFromSupabase.machine_id,
        machineName: machine ? machine.name : 'Ukjent maskin',
        startTime: new Date(newDowntimeFromSupabase.start_time).getTime(),
        endTime: new Date(newDowntimeFromSupabase.end_time).getTime(),
        duration: newDowntimeFromSupabase.duration,
        comment: newDowntimeFromSupabase.comment,
        postNumber: newDowntimeFromSupabase.post_number,
        date: newDowntimeFromSupabase.date,
        operatorId: newDowntimeFromSupabase.operator_id,
        operatorName: operator ? operator.name : 'Ukjent operator',
      };

      setDowntimeHistory(prev => [enrichedDowntime, ...prev]);
      setActiveDowntimes(activeDowntimes.filter(d => d.id !== commentModal.id));
      
      setCommentModal(null);
      setComment('');
      setPostNumber('');
    }
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
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-3xl"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-16">
                <div className="relative mb-12">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                    <Clock className="w-16 h-16 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-400 rounded-full border-4 border-white shadow-sm"></div>
                </div>
                
                <h1 className="text-6xl font-bold text-gray-900 mb-6">Velkommen</h1>
                <p className="text-2xl text-gray-600 mb-8">Logg inn for å fortsette</p>
                
                <div className="inline-flex items-center gap-4 px-8 py-4 bg-blue-50 rounded-full border border-blue-100">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-xl font-medium text-blue-700">Haslestad</span>
                </div>
              </div>

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
        </div>
        
        <div className="text-center mt-12">
          <p className="text-[10px] text-gray-400">
            © 2025 Kuszynski
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Rejestrator Postojów</h1>
          <p className="text-xl text-gray-300">
            {new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Logg ut
            </button>
          </div>
        </div>

        {commentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
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
                    placeholder="Beskriv hva som skjedde..."
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

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    💡 <strong>Tips:</strong> Beskriv kort og tydelig hva som forårsaket stansen for bedre oppfølging.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}