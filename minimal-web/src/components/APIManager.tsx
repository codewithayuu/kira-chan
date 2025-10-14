'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Key, CheckCircle, XCircle, TestTube, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface APIStatus {
  groq: boolean;
  gemini: boolean;
  openai: boolean;
  huggingface: boolean;
  openrouter: boolean;
}

interface APIManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function APIManager({ isOpen, onClose }: APIManagerProps) {
  const [apiStatus, setApiStatus] = useState<APIStatus>({
    groq: false,
    gemini: false,
    openai: false,
    huggingface: false,
    openrouter: false,
  });
  const [apiKeys, setApiKeys] = useState({
    groq: '',
    gemini: '',
    openai: '',
    huggingface: '',
    openrouter: '',
  });
  const [showKeys, setShowKeys] = useState({
    groq: false,
    gemini: false,
    openai: false,
    huggingface: false,
    openrouter: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const providers = [
    { id: 'groq', name: 'Groq', description: 'Fast & Free (14,400 requests/day)', color: 'bg-green-500' },
    { id: 'gemini', name: 'Google Gemini', description: 'Google AI (15 requests/minute)', color: 'bg-blue-500' },
    { id: 'openai', name: 'OpenAI', description: 'GPT models (Pay per use)', color: 'bg-purple-500' },
    { id: 'huggingface', name: 'Hugging Face', description: 'Open source models', color: 'bg-yellow-500' },
    { id: 'openrouter', name: 'OpenRouter', description: 'Multiple providers', color: 'bg-indigo-500' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchAPIStatus();
    }
  }, [isOpen]);

  const fetchAPIStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/keys/status');
      const status = await response.json();
      setApiStatus(status);
    } catch (error) {
      console.error('Failed to fetch API status:', error);
    }
  };

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const handleSaveKey = async (provider: string) => {
    const apiKey = apiKeys[provider as keyof typeof apiKeys];
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/keys/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`${provider} API key updated successfully!`);
        fetchAPIStatus();
      } else {
        toast.error(result.error || 'Failed to update API key');
      }
    } catch (error) {
      toast.error('Failed to update API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLLM = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/llm/test');
      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        toast.success('LLM test successful!');
      } else {
        toast.error('LLM test failed: ' + result.error);
      }
    } catch (error) {
      toast.error('Failed to test LLM');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider as keyof typeof prev] }));
  };

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
              <h2 className="text-2xl font-bold text-gray-800">API Key Manager</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Test Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Test LLM Connection</h3>
                <button
                  onClick={handleTestLLM}
                  disabled={isLoading}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <TestTube size={16} />
                  {isLoading ? 'Testing...' : 'Test LLM'}
                </button>
              </div>
              
              {testResult && (
                <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {testResult.success ? 'Test Successful!' : 'Test Failed'}
                    </span>
                  </div>
                  {testResult.success && (
                    <div className="text-sm text-gray-600">
                      <p><strong>Model:</strong> {testResult.model}</p>
                      <p><strong>Provider:</strong> {testResult.provider}</p>
                      <p><strong>Response:</strong> {testResult.response}</p>
                    </div>
                  )}
                  {!testResult.success && (
                    <div className="text-sm text-red-600">
                      <p><strong>Error:</strong> {testResult.error}</p>
                      <p><strong>Details:</strong> {testResult.details}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* API Keys Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">API Keys</h3>
              
              {providers.map((provider) => (
                <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${provider.color} ${apiStatus[provider.id as keyof APIStatus] ? 'ring-2 ring-green-400' : ''}`}></div>
                      <div>
                        <h4 className="font-medium text-gray-800">{provider.name}</h4>
                        <p className="text-sm text-gray-500">{provider.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {apiStatus[provider.id as keyof APIStatus] ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showKeys[provider.id as keyof typeof showKeys] ? 'text' : 'password'}
                        value={apiKeys[provider.id as keyof typeof apiKeys]}
                        onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                        placeholder={`Enter ${provider.name} API key...`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10"
                      />
                      <button
                        onClick={() => toggleShowKey(provider.id)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showKeys[provider.id as keyof typeof showKeys] ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={isLoading || !apiKeys[provider.id as keyof typeof apiKeys].trim()}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save size={16} />
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Help Section */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">How to get API keys:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Groq:</strong> https://console.groq.com/ (Free, 14,400 requests/day)</li>
                <li>• <strong>Gemini:</strong> https://aistudio.google.com/ (Free, 15 requests/minute)</li>
                <li>• <strong>OpenAI:</strong> https://platform.openai.com/ (Pay per use)</li>
                <li>• <strong>Hugging Face:</strong> https://huggingface.co/settings/tokens (Free)</li>
                <li>• <strong>OpenRouter:</strong> https://openrouter.ai/ (Free models available)</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
