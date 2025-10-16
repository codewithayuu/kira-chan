'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Brain, 
  MessageSquare, 
  Clock, 
  Zap,
  Target,
  Activity,
  Users,
  RefreshCw
} from 'lucide-react';

interface QualityMetrics {
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  avgQualityScore: number;
  providerUsage: Record<string, number>;
  dialogActDistribution: Record<string, number>;
  emotionDistribution: Record<string, number>;
  lsmScores: number[];
  memoryRetrievals: number;
  reEdits: number;
  avgLsmScore: number;
  errorRate: number;
  reEditRate: number;
}

interface SystemStats {
  status: string;
  providers: number;
  conversations: number;
  memoryUsers: number;
  timestamp: string;
}

export default function QualityDashboard() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.warn('Failed to fetch metrics:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchStats()]);
      setLoading(false);
    };

    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-white/70" />
          <span className="ml-2 text-white/70">Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 backdrop-blur-sm rounded-lg p-6 border border-red-500/30">
        <div className="flex items-center text-red-400">
          <Activity className="w-5 h-5 mr-2" />
          <span>Error loading metrics: {error}</span>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatPercentage = (num: number) => (num * 100).toFixed(1) + '%';

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getQualityGrade = (score: number) => {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B';
    if (score >= 0.6) return 'C';
    return 'D';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-8 h-8 text-purple-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Quality Dashboard</h2>
            <p className="text-white/70">Real-time system performance metrics</p>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            Promise.all([fetchMetrics(), fetchStats()]).finally(() => setLoading(false));
          }}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* System Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-white/70">Status</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1 capitalize">{stats.status}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-blue-400" />
              <span className="text-white/70">Providers</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{stats.providers}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              <span className="text-white/70">Conversations</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{formatNumber(stats.conversations)}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-pink-400" />
              <span className="text-white/70">Memory Users</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{formatNumber(stats.memoryUsers)}</p>
          </div>
        </div>
      )}

      {/* Quality Metrics */}
      {metrics && (
        <>
          {/* Core Quality Scores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-green-400" />
                  <span className="text-white/70">Overall Quality</span>
                </div>
                <span className={`text-2xl font-bold ${getQualityColor(metrics.avgQualityScore)}`}>
                  {getQualityGrade(metrics.avgQualityScore)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Score</span>
                  <span className="text-white">{formatPercentage(metrics.avgQualityScore)}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-blue-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.avgQualityScore * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <span className="text-white/70">Style Match</span>
                </div>
                <span className={`text-2xl font-bold ${getQualityColor(metrics.avgLsmScore)}`}>
                  {formatPercentage(metrics.avgLsmScore)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">LSM Score</span>
                  <span className="text-white">{metrics.lsmScores.length} samples</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.avgLsmScore * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="text-white/70">Response Time</span>
                </div>
                <span className="text-2xl font-bold text-white">
                  {metrics.avgResponseTime.toFixed(0)}ms
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Average</span>
                  <span className="text-white">{formatNumber(metrics.totalRequests)} requests</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (5000 - metrics.avgResponseTime) / 50)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-red-400" />
                Error Rate
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Errors</span>
                  <span className="text-white">{formatNumber(metrics.totalErrors)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Rate</span>
                  <span className="text-red-400">{formatPercentage(metrics.errorRate)}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-red-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.errorRate * 1000)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <RefreshCw className="w-5 h-5 mr-2 text-orange-400" />
                Re-Edit Rate
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Re-edits</span>
                  <span className="text-white">{formatNumber(metrics.reEdits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Rate</span>
                  <span className="text-orange-400">{formatPercentage(metrics.reEditRate)}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-orange-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.reEditRate * 200)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Provider Usage */}
          {Object.keys(metrics.providerUsage).length > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-400" />
                Provider Usage
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.providerUsage)
                  .sort(([,a], [,b]) => b - a)
                  .map(([provider, count]) => (
                    <div key={provider} className="flex items-center justify-between">
                      <span className="text-white/70 capitalize">{provider}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-white/20 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${(count / Math.max(...Object.values(metrics.providerUsage))) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-white w-12 text-right">{formatNumber(count)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Dialog Act Distribution */}
          {Object.keys(metrics.dialogActDistribution).length > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-blue-400" />
                Dialog Act Distribution
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(metrics.dialogActDistribution)
                  .sort(([,a], [,b]) => b - a)
                  .map(([act, count]) => (
                    <div key={act} className="text-center">
                      <div className="text-2xl font-bold text-white">{formatNumber(count)}</div>
                      <div className="text-sm text-white/70 capitalize">{act}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Memory Statistics */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-green-400" />
              Memory System
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{formatNumber(metrics.memoryRetrievals)}</div>
                <div className="text-sm text-white/70">Total Retrievals</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{formatNumber(metrics.totalRequests)}</div>
                <div className="text-sm text-white/70">Conversations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {metrics.totalRequests > 0 ? (metrics.memoryRetrievals / metrics.totalRequests).toFixed(1) : '0'}
                </div>
                <div className="text-sm text-white/70">Avg per Conversation</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Last Updated */}
      <div className="text-center text-white/50 text-sm">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
