'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Machine {
  id: string;
  name: string;
  color: string;
}

const COLORS = [
  'bg-blue-500',
  'bg-green-500', 
  'bg-yellow-500',
  'bg-purple-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-rose-500',
  'bg-slate-500'
];

export default function MachineManager() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('bg-blue-500');

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading machines:', error);
        return;
      }

      setMachines(data || []);
    } catch (error) {
      console.error('Unexpected error loading machines:', error);
    }
  };



  const addMachine = async () => {
    if (!newName.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('machines')
        .insert({
          id: `m${Date.now()}`,
          name: newName.trim(),
          color: newColor
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding machine:', error);
        alert('Feil ved lagring av maskin');
        return;
      }

      setMachines([...machines, data]);
      setNewName('');
      setNewColor('bg-blue-500');
      setShowAddForm(false);
    } catch (error) {
      console.error('Unexpected error adding machine:', error);
      alert('Uventet feil ved lagring av maskin');
    }
  };

  const startEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setEditName(machine.name);
    setEditColor(machine.color);
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('machines')
        .update({
          name: editName.trim(),
          color: editColor
        })
        .eq('id', editingId)
        .select()
        .single();

      if (error) {
        console.error('Error updating machine:', error);
        alert('Feil ved oppdatering av maskin');
        return;
      }

      setMachines(machines.map(m => 
        m.id === editingId ? data : m
      ));
      setEditingId(null);
      setEditName('');
      setEditColor('');
    } catch (error) {
      console.error('Unexpected error updating machine:', error);
      alert('Uventet feil ved oppdatering av maskin');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const deleteMachine = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette denne maskinen?')) return;
    
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting machine:', error);
        alert('Feil ved sletting av maskin');
        return;
      }

      setMachines(machines.filter(m => m.id !== id));
    } catch (error) {
      console.error('Unexpected error deleting machine:', error);
      alert('Uventet feil ved sletting av maskin');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">🏭 Maskinadministrasjon</h2>
            <p className="text-blue-100">Administrer maskiner som kan registreres for stanser</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{machines.length}</div>
              <div className="text-blue-100 text-sm">Totalt maskiner</div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Legg til maskin
            </button>
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Legg til ny maskin</h3>
              <p className="text-sm text-gray-600">Fyll ut informasjonen nedenfor</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏭 Maskinnavn *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="F.eks. Hjullaster, Tømmerbord..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🎨 Farge *
              </label>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${newColor} border-2 border-white shadow-md`}></div>
                <select
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  {COLORS.map(color => (
                    <option key={color} value={color}>
                      {color.replace('bg-', '').replace('-500', '').charAt(0).toUpperCase() + color.replace('bg-', '').replace('-500', '').slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-blue-200">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName('');
                setNewColor('bg-blue-500');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
            >
              <X className="w-4 h-4" />
              Avbryt
            </button>
            <button
              onClick={addMachine}
              disabled={!newName.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <Save className="w-4 h-4" />
              Legg til maskin
            </button>
          </div>
        </div>
      )}

      {/* Machines table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-4 font-semibold text-gray-700">#</th>
                <th className="text-left p-4 font-semibold text-gray-700">Maskinnavn</th>
                <th className="text-center p-4 font-semibold text-gray-700">Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine, index) => (
                <tr key={machine.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${machine.color} flex items-center justify-center text-white font-bold text-lg`}>
                        {index + 1}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {editingId === machine.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                          placeholder="Skriv inn maskinnavn"
                        />
                        <select
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {COLORS.map(color => (
                            <option key={color} value={color}>
                              {color.replace('bg-', '').replace('-500', '').charAt(0).toUpperCase() + color.replace('bg-', '').replace('-500', '').slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-gray-900 text-xl">{machine.name}</p>
                        <p className="text-sm text-gray-500 mt-1">ID: {machine.id}</p>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-3">
                      {editingId === machine.id ? (
                        <>
                          <button
                            onClick={saveEdit}
                            disabled={!editName.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg disabled:bg-gray-100 disabled:text-gray-400 font-medium transition-colors"
                          >
                            <Save className="w-4 h-4" />
                            Lagre
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Avbryt
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(machine)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors"
                            title="Rediger maskin"
                          >
                            <Edit2 className="w-4 h-4" />
                            Rediger
                          </button>
                          <button
                            onClick={() => deleteMachine(machine.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                            title="Slett maskin"
                          >
                            <Trash2 className="w-4 h-4" />
                            Slett
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {machines.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingen maskiner registrert</h3>
              <p className="text-gray-500">Klikk på "Legg til maskin" for å legge til din første maskin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}