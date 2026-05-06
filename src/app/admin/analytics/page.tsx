"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminAnalytics() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({
    langDistributionData: [],
    activeHoursData: [],
    prefData: []
  });

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ success: boolean; data: any }>('/api/admin/analytics');
      if (response.success) {
        setData(response.data);
      } else {
        throw new Error('Failed to fetch analytics');
      }
    } catch (err: any) {
      setError(err.message || '發生未知錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchAnalytics();
  }, []);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">語言版本與行為分析模組</h2>
        <button 
          onClick={fetchAnalytics}
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Activity size={18} className={isLoading ? "animate-spin" : ""} />
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
            <button onClick={fetchAnalytics} className="flex items-center gap-1 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors">
              <RefreshCw size={14} /> 重試
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 z-10 flex justify-center items-center backdrop-blur-[1px] rounded-xl">
            <Activity className="animate-spin text-indigo-500" size={32} />
          </div>
        )}
        {/* Language User Distribution */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">各語言版本用戶佔比</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.langDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="users"
                  stroke="none"
                >
                  {data.langDistributionData?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} 人`, '用戶數']} contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Avg Volume per Language */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">各語言總投注金額與用戶數</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.langDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="volume" name="總金額 (USDT)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="users" name="用戶數" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active Hours (Area Chart) */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">24小時活躍時段分佈 (依語言)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activeHoursData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorZH" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                <Legend />
                <Area type="monotone" dataKey="EN" stroke="#6366f1" fillOpacity={1} fill="url(#colorEN)" strokeWidth={2} />
                <Area type="monotone" dataKey="ZH" stroke="#10b981" fillOpacity={1} fill="url(#colorZH)" strokeWidth={2} />
                <Area type="monotone" dataKey="JA" stroke="#f59e0b" fillOpacity={0.5} fill="#f59e0b" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Betting Preferences */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">各語言體育項目投注偏好</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.prefData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="sport" type="category" stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="EN" stackId="a" fill="#6366f1" />
                <Bar dataKey="ZH" stackId="a" fill="#10b981" />
                <Bar dataKey="JA" stackId="a" fill="#f59e0b" />
                <Bar dataKey="KO" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
