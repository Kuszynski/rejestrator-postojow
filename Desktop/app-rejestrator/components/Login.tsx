'use client';

import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { authenticateUser } from '../lib/auth';

interface User {
  id: string;
  name: string;
  role: 'operator' | 'manager' | 'admin';
  email?: string;
}

interface LoginProps {
  onLogin: (user: User) => void;
}

// Mapowanie użytkowników na role
const USER_ROLES = {
  'Dag': { role: 'manager', name: 'Dag' },
  'operator': { role: 'operator', name: 'Operator' },
  'admin': { role: 'admin', name: 'Administrator' },
};

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Vennligst skriv inn brukernavn og passord.');
      return;
    }

    try {
      const result = await authenticateUser(username, password);
      
      if (result.success) {
        const userConfig = USER_ROLES[username] || { role: 'operator', name: username };
        
        onLogin({
          id: username,
          name: userConfig.name,
          role: userConfig.role as 'operator' | 'manager' | 'admin'
        });
      } else {
        setError(result.error || 'Feil brukernavn eller passord');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Feil ved innlogging. Prøv igjen.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Logg inn</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
                placeholder="Brukernavn"
                required
                autoFocus
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
                placeholder="Passord"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-6"
            >
              Fortsett
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-600 mb-2 font-medium">Testkontoer:</p>
            <div className="space-y-1 text-xs text-gray-500">
              <div>Manager: Dag / test123</div>
              <div>Operator: operator / operator123</div>
              <div>Admin: admin / admin123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}