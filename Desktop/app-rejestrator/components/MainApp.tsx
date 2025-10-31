'use client';

import { useState, useEffect } from 'react';
import { User, BarChart3, FileText, Calendar, Settings, LogOut, Shield } from 'lucide-react';
import EnhancedDowntimeTracker from './EnhancedDowntimeTracker';
import ManagerDashboard from './ManagerDashboard';
import ReportSystem from './ReportSystem';
import GanttChart from './GanttChart';
import Login from './Login';
import PWAInstaller from './PWAInstaller';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

type UserRole = 'operator' | 'manager' | 'admin';
type View = 'tracker' | 'dashboard' | 'reports' | 'gantt' | 'settings';

interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
}

export default function MainApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('tracker');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Sprawdź czy użytkownik jest zalogowany
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Ustaw domyślny widok na podstawie roli
    if (user.role === 'manager' || user.role === 'admin') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('tracker');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setCurrentView('tracker');
  };

  const canAccess = (view: View): boolean => {
    if (!currentUser) return view === 'tracker';
    
    switch (view) {
      case 'tracker':
        return true;
      case 'dashboard':
        return currentUser.role === 'manager' || currentUser.role === 'admin';
      case 'reports':
        return currentUser.role === 'manager' || currentUser.role === 'admin';
      case 'gantt':
        return currentUser.role === 'manager' || currentUser.role === 'admin';
      case 'settings':
        return currentUser.role === 'admin';
      default:
        return false;
    }
  };

  const getNavItems = () => {
    const items = [
      { id: 'tracker', label: 'Rejestrator', icon: User, color: 'text-blue-600' },
    ];

    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
      items.push(
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3, color: 'text-green-600' },
        { id: 'reports', label: 'Raporty', icon: FileText, color: 'text-purple-600' },
        { id: 'gantt', label: 'Gantt', icon: Calendar, color: 'text-blue-600' }
      );
    }

    if (currentUser && currentUser.role === 'admin') {
      items.push(
        { id: 'settings', label: 'Ustawienia', icon: Settings, color: 'text-gray-600' }
      );
    }

    return items;
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'tracker':
        return <EnhancedDowntimeTracker />;
      case 'dashboard':
        return canAccess('dashboard') ? <ManagerDashboard /> : <div>Brak uprawnień</div>;
      case 'reports':
        return canAccess('reports') ? <ReportSystem /> : <div>Brak uprawnień</div>;
      case 'gantt':
        return canAccess('gantt') ? <GanttChart /> : <div>Brak uprawnień</div>;
      case 'settings':
        return canAccess('settings') ? <SettingsPanel /> : <div>Brak uprawnień</div>;
      default:
        return <EnhancedDowntimeTracker />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // Jeśli nie ma użytkownika, pokaż login
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Rejestrator Postojów</h1>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
                    <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                      {currentUser.role === 'admin' && <Shield className="w-3 h-3" />}
                      {currentUser.role === 'manager' ? 'Manager' : 
                       currentUser.role === 'admin' ? 'Administrator' : 'Operator'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Wyloguj"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              {!currentUser && (
                <button
                  onClick={() => setCurrentView('tracker')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Zaloguj się
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg md:hidden z-50">
        <div className="flex">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as View)}
              className={`flex-1 py-3 px-2 text-center transition-colors ${
                currentView === item.id
                  ? `${item.color} bg-blue-50`
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <item.icon className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Side Navigation (Desktop) */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:w-64 md:bg-white md:shadow-sm md:border-r md:top-16">
        <nav className="mt-8 px-4">
          <div className="space-y-2">
            {getNavItems().map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as View)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                  currentView === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main className="md:ml-64 pt-0 pb-20 md:pb-0">
        {renderCurrentView()}
      </main>
      
      {/* PWA Installer */}
      <PWAInstaller />
      
      {/* Service Worker Registration */}
      <ServiceWorkerRegistration />
    </div>
  );
}

// Komponent ustawień
function SettingsPanel() {
  const [settings, setSettings] = useState({
    companyName: 'Moja Firma',
    alertThreshold: 30,
    autoBackup: true,
    emailNotifications: true,
    language: 'pl'
  });

  useEffect(() => {
    const stored = localStorage.getItem('appSettings');
    if (stored) {
      setSettings({ ...settings, ...JSON.parse(stored) });
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    alert('Ustawienia zapisane!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Ustawienia systemu</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nazwa firmy
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Próg alertu (minuty)
              </label>
              <input
                type="number"
                value={settings.alertThreshold}
                onChange={(e) => setSettings({...settings, alertThreshold: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.autoBackup}
                  onChange={(e) => setSettings({...settings, autoBackup: e.target.checked})}
                />
                Automatyczne kopie zapasowe
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
                />
                Powiadomienia email
              </label>
            </div>

            <button
              onClick={saveSettings}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Zapisz ustawienia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}