"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, DollarSign, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { apiClient } from '@/lib/api/client';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444']; // updated to tailwind colors

export default function AdminDashboard() {
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await apiClient.get<{ success: boolean; data: { liveMatches: any[], trendData: any[], distributionData: any[] } }>('/api/admin/dashboard');
      if (response.success) {
        setLiveMatches(response.data.liveMatches || []);
        setTrendData(response.data.trendData || []);
        setDistributionData(response.data.distributionData || []);
        setLastUpdated(new Date());
      } else {
        throw new Error('Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message || '發生未知錯誤');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh mechanism
  useEffect(() => {
    setIsMounted(true);
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const totalGlobalPool = liveMatches.reduce((acc, match) => acc + match.totalPool, 0);
  const totalGlobalBets = liveMatches.reduce((acc, match) => acc + match.totalBets, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">即時球賽投注數據監控 (Live Dashboard)</h2>
          <p className="text-sm text-slate-500 mt-1 flex items-center">
            最後更新時間: {lastUpdated ? lastUpdated.toLocaleTimeString() : '...'} 
            {isRefreshing && <span className="text-indigo-500 ml-2 animate-pulse flex items-center"><Activity size={14} className="mr-1 animate-spin" /> 更新中...</span>}
          </p>
        </div>
        <button 
          onClick={fetchDashboardData}
          disabled={isRefreshing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Activity size={18} className={isRefreshing ? "animate-spin" : ""} />
          <span>手動刷新</span>
        </button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center justify-between text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} />
              <span>資料載入失敗: {error}</span>
            </div>
            <button onClick={fetchDashboardData} className="flex items-center gap-1 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors">
              <RefreshCw size={14} /> 重試
            </button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">進行中球賽總數</CardTitle>
            <Activity className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{liveMatches.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">即時在投注池金額的數據</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">${totalGlobalPool.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">總投注筆數</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{totalGlobalBets.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">系統活躍度</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">High</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">近1小時投注金額趨勢</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">體育項目投注分布</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  innerRadius={50} // Donut style
                  fill="#8884d8"
                  dataKey="value"
                  stroke="none"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Live Matches Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-800">進行中球賽詳細數據 (即時)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">對戰隊伍</th>
                  <th className="px-6 py-4 font-semibold">狀態</th>
                  <th className="px-6 py-4 font-semibold">主隊賠率</th>
                  <th className="px-6 py-4 font-semibold">客隊賠率</th>
                  <th className="px-6 py-4 font-semibold">投注金額 (USDT)</th>
                  <th className="px-6 py-4 font-semibold">投注筆數</th>
                </tr>
              </thead>
              <tbody>
                {liveMatches.map((match, idx) => (
                  <tr key={match.id} className={`bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx === liveMatches.length - 1 ? 'border-none' : ''}`}>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {match.teamA} <span className="text-slate-400 mx-2">vs</span> {match.teamB}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse border border-red-200">
                        {match.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{match.oddsA}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{match.oddsB}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">${match.totalPool.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-600">{match.totalBets.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
