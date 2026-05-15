"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminAnalytics() {
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
      const response = await fetch('/api/admin/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const json = await response.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error('Failed to fetch analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生未知錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="分析"
        description="保留語言與行為分析能力，但統一到新的深色後台視覺體系"
        actions={
          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        }
      />

      {error ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 relative">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-neutral-950/50 backdrop-blur-[1px]">
            <Activity className="animate-spin text-primary-purple" size={32} />
          </div>
        ) : null}
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="mb-4 text-lg font-bold text-white">各語言版本用戶佔比</div>
          <div className="h-80 flex justify-center">
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
                <Tooltip formatter={(value) => [`${value} 人`, '用戶數']} contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="mb-4 text-lg font-bold text-white">各語言總投注金額與用戶數</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.langDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis dataKey="name" stroke="#a3a3a3" />
                <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="volume" name="總金額 (USDT)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="users" name="用戶數" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5 md:col-span-2">
          <div className="mb-4 text-lg font-bold text-white">24 小時活躍時段分佈</div>
          <div className="h-80">
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
                <XAxis dataKey="hour" stroke="#a3a3a3" />
                <YAxis stroke="#a3a3a3" />
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px' }} />
                <Legend />
                <Area type="monotone" dataKey="EN" stroke="#6366f1" fillOpacity={1} fill="url(#colorEN)" strokeWidth={2} />
                <Area type="monotone" dataKey="ZH" stroke="#10b981" fillOpacity={1} fill="url(#colorZH)" strokeWidth={2} />
                <Area type="monotone" dataKey="JA" stroke="#f59e0b" fillOpacity={0.5} fill="#f59e0b" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5 md:col-span-2">
          <div className="mb-4 text-lg font-bold text-white">各語言體育項目投注偏好</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.prefData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis type="number" stroke="#a3a3a3" />
                <YAxis dataKey="sport" type="category" stroke="#a3a3a3" />
                <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px' }} />
                <Legend />
                <Bar dataKey="EN" stackId="a" fill="#6366f1" />
                <Bar dataKey="ZH" stackId="a" fill="#10b981" />
                <Bar dataKey="JA" stackId="a" fill="#f59e0b" />
                <Bar dataKey="KO" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
