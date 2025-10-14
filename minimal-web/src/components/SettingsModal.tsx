import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PersonaConfig {
  name: string;
  systemPrompt: string;
}

interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persona, setPersona] = useState<PersonaConfig>({ name: '', systemPrompt: '' });
  const [model, setModel] = useState<ModelConfig>({ provider: 'groq', model: 'llama-3.1-8b-instant', temperature: 0.7, maxTokens: 150, topP: 1, presencePenalty: 0, frequencyPenalty: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:3001/api/config');
        const json = await res.json();
        if (json?.success) {
          setPersona(json.config.persona);
          setModel(json.config.model);
        } else {
          setError('Failed to load settings');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('http://localhost:3001/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona, model })
      });
      const json = await res.json();
      if (json?.success) {
        setSuccess('Settings saved');
      } else {
        setError(json?.error || 'Failed to save');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('http://localhost:3001/api/config/reset', { method: 'POST' });
      const json = await res.json();
      if (json?.success) {
        setPersona(json.config.persona);
        setModel(json.config.model);
        setSuccess('Reset to defaults');
      } else {
        setError(json?.error || 'Failed to reset');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Persona</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input className="input-field w-full" value={persona.name} onChange={e => setPersona({ ...persona, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">System Prompt</label>
                      <textarea className="input-field w-full h-28" value={persona.systemPrompt} onChange={e => setPersona({ ...persona, systemPrompt: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Model</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Provider</label>
                      <input className="input-field w-full" value={model.provider} onChange={e => setModel({ ...model, provider: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Model</label>
                      <input className="input-field w-full" value={model.model} onChange={e => setModel({ ...model, model: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Temperature</label>
                      <input type="number" step="0.1" className="input-field w-full" value={model.temperature} onChange={e => setModel({ ...model, temperature: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Max Tokens</label>
                      <input type="number" className="input-field w-full" value={model.maxTokens} onChange={e => setModel({ ...model, maxTokens: parseInt(e.target.value, 10) })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Top P</label>
                      <input type="number" step="0.05" className="input-field w-full" value={model.topP} onChange={e => setModel({ ...model, topP: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Presence Penalty</label>
                      <input type="number" step="0.1" className="input-field w-full" value={model.presencePenalty} onChange={e => setModel({ ...model, presencePenalty: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Frequency Penalty</label>
                      <input type="number" step="0.1" className="input-field w-full" value={model.frequencyPenalty} onChange={e => setModel({ ...model, frequencyPenalty: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}

                <div className="flex justify-between gap-2">
                  <button onClick={resetToDefaults} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">Reset</button>
                  <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">Close</button>
                    <button disabled={saving} onClick={save} className="px-4 py-2 rounded-md bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


