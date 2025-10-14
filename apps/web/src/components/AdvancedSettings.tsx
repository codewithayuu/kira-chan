'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Mic, Volume2, Palette, Brain, Heart, Zap, Save, RotateCcw } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useValidation, VoiceSettingsSchema, Live2DSettingsSchema, UserProfileSchema } from '@/lib/validation';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdvancedSettings({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'voice' | 'avatar' | 'personality' | 'memory' | 'advanced'>('voice');
  const [hasChanges, setHasChanges] = useState(false);
  
  const {
    selectedVoice,
    setSelectedVoice,
    availableVoices,
    loadVoices,
  } = useVoiceStore();

  // Validation hooks
  const voiceValidation = useValidation(VoiceSettingsSchema);
  const avatarValidation = useValidation(Live2DSettingsSchema);
  const profileValidation = useValidation(UserProfileSchema);

  // Settings state
  const [voiceSettings, setVoiceSettings] = useState({
    provider: 'elevenlabs',
    voice: selectedVoice,
    language: 'en',
    speed: 1,
    pitch: 1,
    volume: 0.8,
    quality: 'high',
    streaming: true,
    autoPlay: true,
    pushToTalk: false,
    voiceActivation: true,
    vadThreshold: 0.5,
    vadSensitivity: 'medium',
  });

  const [avatarSettings, setAvatarSettings] = useState({
    modelPath: '/models/hiyori/hiyori_free_t08.model3.json',
    scale: 0.3,
    position: { x: 200, y: 450 },
    animations: {
      idle: 'idle',
      happy: 'happy',
      sad: 'sad',
      surprised: 'surprised',
      thinking: 'thinking',
      talking: 'talking',
    },
    lipSync: {
      enabled: true,
      sensitivity: 0.7,
      smoothing: 0.8,
      parameters: ['PARAM_MOUTH_OPEN_Y'],
    },
    interactions: {
      clickable: true,
      hoverable: true,
      draggable: false,
      autoIdle: true,
      idleTimeout: 30000,
    },
  });

  const [personalitySettings, setPersonalitySettings] = useState({
    name: 'Aanya',
    language: 'hinglish',
    personality: 'romantic',
    emojiLevel: 'medium',
    responseLength: 'medium',
    interests: ['technology', 'music', 'travel'],
    relationshipLevel: 'new',
    customInstructions: '',
  });

  const [memorySettings, setMemorySettings] = useState({
    enabled: true,
    maxMemories: 1000,
    memoryTypes: ['fact', 'moment', 'preference', 'memory'],
    autoExtract: true,
    importanceThreshold: 0.3,
    retentionDays: 365,
  });

  const [advancedSettings, setAdvancedSettings] = useState({
    debugMode: false,
    performanceMode: 'balanced',
    cacheEnabled: true,
    analyticsEnabled: true,
    errorReporting: true,
    autoUpdates: true,
    experimentalFeatures: false,
  });

  useEffect(() => {
    if (isOpen) {
      loadVoices();
    }
  }, [isOpen, loadVoices]);

  const handleSave = () => {
    // Validate all settings
    const voiceResult = voiceValidation.validate(voiceSettings);
    const avatarResult = avatarValidation.validate(avatarSettings);
    const profileResult = profileValidation.validate(personalitySettings);

    if (!voiceResult.success || !avatarResult.success || !profileResult.success) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    // Save settings to localStorage
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
    localStorage.setItem('avatarSettings', JSON.stringify(avatarSettings));
    localStorage.setItem('personalitySettings', JSON.stringify(personalitySettings));
    localStorage.setItem('memorySettings', JSON.stringify(memorySettings));
    localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings));

    // Update voice store
    setSelectedVoice(voiceSettings.voice);

    setHasChanges(false);
    toast.success('Settings saved successfully!');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      // Reset to default values
      setVoiceSettings({
        provider: 'elevenlabs',
        voice: 'bella',
        language: 'en',
        speed: 1,
        pitch: 1,
        volume: 0.8,
        quality: 'high',
        streaming: true,
        autoPlay: true,
        pushToTalk: false,
        voiceActivation: true,
        vadThreshold: 0.5,
        vadSensitivity: 'medium',
      });
      
      setHasChanges(true);
      toast.success('Settings reset to default');
    }
  };

  const handleChange = (category: string, field: string, value: any) => {
    setHasChanges(true);
    
    switch (category) {
      case 'voice':
        setVoiceSettings(prev => ({ ...prev, [field]: value }));
        break;
      case 'avatar':
        setAvatarSettings(prev => ({ ...prev, [field]: value }));
        break;
      case 'personality':
        setPersonalitySettings(prev => ({ ...prev, [field]: value }));
        break;
      case 'memory':
        setMemorySettings(prev => ({ ...prev, [field]: value }));
        break;
      case 'advanced':
        setAdvancedSettings(prev => ({ ...prev, [field]: value }));
        break;
    }
  };

  const tabs = [
    { id: 'voice', label: 'Voice', icon: Mic },
    { id: 'avatar', label: 'Avatar', icon: Palette },
    { id: 'personality', label: 'Personality', icon: Heart },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'advanced', label: 'Advanced', icon: Zap },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-gray-800">Advanced Settings</h2>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-sm text-orange-500">Unsaved changes</span>
              )}
              <button
                onClick={handleReset}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-pink-500 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'voice' && (
                <VoiceSettingsTab
                  settings={voiceSettings}
                  onChange={(field, value) => handleChange('voice', field, value)}
                  availableVoices={availableVoices}
                  errors={voiceValidation.errors}
                />
              )}
              
              {activeTab === 'avatar' && (
                <AvatarSettingsTab
                  settings={avatarSettings}
                  onChange={(field, value) => handleChange('avatar', field, value)}
                  errors={avatarValidation.errors}
                />
              )}
              
              {activeTab === 'personality' && (
                <PersonalitySettingsTab
                  settings={personalitySettings}
                  onChange={(field, value) => handleChange('personality', field, value)}
                  errors={profileValidation.errors}
                />
              )}
              
              {activeTab === 'memory' && (
                <MemorySettingsTab
                  settings={memorySettings}
                  onChange={(field, value) => handleChange('memory', field, value)}
                />
              )}
              
              {activeTab === 'advanced' && (
                <AdvancedSettingsTab
                  settings={advancedSettings}
                  onChange={(field, value) => handleChange('advanced', field, value)}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Settings are automatically saved to your browser
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Individual settings tab components
function VoiceSettingsTab({ settings, onChange, availableVoices, errors }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Voice Settings</h3>
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice Provider
          </label>
          <select
            value={settings.provider}
            onChange={(e) => onChange('provider', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="elevenlabs">ElevenLabs</option>
            <option value="azure">Azure Speech</option>
            <option value="piper">Piper TTS</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice
          </label>
          <select
            value={settings.voice}
            onChange={(e) => onChange('voice', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            {availableVoices.map((voice: string) => (
              <option key={voice} value={voice}>
                {voice.charAt(0).toUpperCase() + voice.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            value={settings.language}
            onChange={(e) => onChange('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quality
          </label>
          <select
            value={settings.quality}
            onChange={(e) => onChange('quality', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Speed: {settings.speed}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.speed}
            onChange={(e) => onChange('speed', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pitch: {settings.pitch}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.pitch}
            onChange={(e) => onChange('pitch', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Volume: {Math.round(settings.volume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.volume}
            onChange={(e) => onChange('volume', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice Activity Detection Threshold: {Math.round(settings.vadThreshold * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.vadThreshold}
            onChange={(e) => onChange('vadThreshold', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.streaming}
            onChange={(e) => onChange('streaming', e.target.checked)}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Enable streaming audio</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.autoPlay}
            onChange={(e) => onChange('autoPlay', e.target.checked)}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Auto-play responses</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.pushToTalk}
            onChange={(e) => onChange('pushToTalk', e.target.checked)}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Push-to-talk mode</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.voiceActivation}
            onChange={(e) => onChange('voiceActivation', e.target.checked)}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Voice activation</span>
        </label>
      </div>
    </div>
  );
}

function AvatarSettingsTab({ settings, onChange, errors }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Avatar Settings</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model Scale: {settings.scale}
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.scale}
            onChange={(e) => onChange('scale', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position X: {settings.position.x}
            </label>
            <input
              type="range"
              min="0"
              max="400"
              value={settings.position.x}
              onChange={(e) => onChange('position', { ...settings.position, x: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position Y: {settings.position.y}
            </label>
            <input
              type="range"
              min="0"
              max="600"
              value={settings.position.y}
              onChange={(e) => onChange('position', { ...settings.position, y: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-lg font-medium text-gray-800">Lip Sync Settings</h4>
        
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.lipSync.enabled}
            onChange={(e) => onChange('lipSync', { ...settings.lipSync, enabled: e.target.checked })}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Enable lip sync</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sensitivity: {Math.round(settings.lipSync.sensitivity * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.lipSync.sensitivity}
            onChange={(e) => onChange('lipSync', { ...settings.lipSync, sensitivity: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Smoothing: {Math.round(settings.lipSync.smoothing * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.lipSync.smoothing}
            onChange={(e) => onChange('lipSync', { ...settings.lipSync, smoothing: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-lg font-medium text-gray-800">Interactions</h4>
        
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.interactions.clickable}
            onChange={(e) => onChange('interactions', { ...settings.interactions, clickable: e.target.checked })}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Clickable</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.interactions.hoverable}
            onChange={(e) => onChange('interactions', { ...settings.interactions, hoverable: e.target.checked })}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Hoverable</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.interactions.draggable}
            onChange={(e) => onChange('interactions', { ...settings.interactions, draggable: e.target.checked })}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Draggable</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.interactions.autoIdle}
            onChange={(e) => onChange('interactions', { ...settings.interactions, autoIdle: e.target.checked })}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Auto idle</span>
        </label>
      </div>
    </div>
  );
}

function PersonalitySettingsTab({ settings, onChange, errors }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Personality Settings</h3>
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => onChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            value={settings.language}
            onChange={(e) => onChange('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="hinglish">Hinglish</option>
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personality
          </label>
          <select
            value={settings.personality}
            onChange={(e) => onChange('personality', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="romantic">Romantic</option>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Emoji Level
          </label>
          <select
            value={settings.emojiLevel}
            onChange={(e) => onChange('emojiLevel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Response Length
          </label>
          <select
            value={settings.responseLength}
            onChange={(e) => onChange('responseLength', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Relationship Level
          </label>
          <select
            value={settings.relationshipLevel}
            onChange={(e) => onChange('relationshipLevel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="new">New</option>
            <option value="acquaintance">Acquaintance</option>
            <option value="friend">Friend</option>
            <option value="close">Close</option>
            <option value="intimate">Intimate</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Interests
        </label>
        <div className="flex flex-wrap gap-2">
          {settings.interests.map((interest: string, index: number) => (
            <span
              key={index}
              className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
            >
              {interest}
              <button
                onClick={() => {
                  const newInterests = settings.interests.filter((_: any, i: number) => i !== index);
                  onChange('interests', newInterests);
                }}
                className="text-pink-600 hover:text-pink-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Add interest..."
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
              onChange('interests', [...settings.interests, e.currentTarget.value.trim()]);
              e.currentTarget.value = '';
            }
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Custom Instructions
        </label>
        <textarea
          value={settings.customInstructions}
          onChange={(e) => onChange('customInstructions', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          placeholder="Add custom instructions for Aanya's behavior..."
        />
      </div>
    </div>
  );
}

function MemorySettingsTab({ settings, onChange }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Memory Settings</h3>
      
      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onChange('enabled', e.target.checked)}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Enable memory system</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Memories: {settings.maxMemories}
          </label>
          <input
            type="range"
            min="100"
            max="10000"
            step="100"
            value={settings.maxMemories}
            onChange={(e) => onChange('maxMemories', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Importance Threshold: {Math.round(settings.importanceThreshold * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.importanceThreshold}
            onChange={(e) => onChange('importanceThreshold', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Retention Days: {settings.retentionDays}
          </label>
          <input
            type="range"
            min="30"
            max="3650"
            step="30"
            value={settings.retentionDays}
            onChange={(e) => onChange('retentionDays', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-lg font-medium text-gray-800">Memory Types</h4>
        {settings.memoryTypes.map((type: string) => (
          <label key={type} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.memoryTypes.includes(type)}
              onChange={(e) => {
                const newTypes = e.target.checked
                  ? [...settings.memoryTypes, type]
                  : settings.memoryTypes.filter((t: string) => t !== type);
                onChange('memoryTypes', newTypes);
              }}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700 capitalize">{type}</span>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.autoExtract}
            onChange={(e) => onChange('autoExtract', e.target.checked)}
            className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
          />
          <span className="text-sm text-gray-700">Auto-extract memories from conversations</span>
        </label>
      </div>
    </div>
  );
}

function AdvancedSettingsTab({ settings, onChange }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Advanced Settings</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Performance Mode
          </label>
          <select
            value={settings.performanceMode}
            onChange={(e) => onChange('performanceMode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="low">Low (Battery Saver)</option>
            <option value="balanced">Balanced</option>
            <option value="high">High Performance</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.debugMode}
              onChange={(e) => onChange('debugMode', e.target.checked)}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">Debug mode</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.cacheEnabled}
              onChange={(e) => onChange('cacheEnabled', e.target.checked)}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">Enable caching</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.analyticsEnabled}
              onChange={(e) => onChange('analyticsEnabled', e.target.checked)}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">Enable analytics</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.errorReporting}
              onChange={(e) => onChange('errorReporting', e.target.checked)}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">Error reporting</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoUpdates}
              onChange={(e) => onChange('autoUpdates', e.target.checked)}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">Auto-updates</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.experimentalFeatures}
              onChange={(e) => onChange('experimentalFeatures', e.target.checked)}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">Experimental features</span>
          </label>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Warning</h4>
        <p className="text-sm text-yellow-700">
          Advanced settings can affect performance and stability. Only modify these if you know what you're doing.
        </p>
      </div>
    </div>
  );
}
