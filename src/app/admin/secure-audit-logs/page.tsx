"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldAlert, Search, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

export default function AdminAuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(`/api/admin/logs?search=${searchTerm}`);
      if (response.success) {
        setLogs(response.data);
      } else {
        throw new Error('Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message || '發生未知錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchLogs();
  }, []);

  const handleSearch = () => {
    fetchLogs();
  };

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
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="text-indigo-600" />
            系統操作日誌 (Audit Logs)
          </h2>
          <p className="text-sm text-slate-500 mt-1">僅限授權管理員存取。所有敏感操作均會被記錄。</p>
        </div>
      </div>

      <Card className="bg-amber-50 border-amber-200 shadow-sm">
        <CardContent className="p-5 flex items-start space-x-3">
          <ShieldAlert className="text-amber-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-800">嚴格存取控制 (RBAC) 啟用中</h3>
            <p className="text-sm text-amber-700 mt-1">您目前以 <strong>超級管理員 (Super Admin)</strong> 身份存取此安全路由。所有操作皆會經過不可篡改的區塊鏈與內部資料庫審計記錄。</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center justify-between text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} />
              <span>資料載入失敗: {error}</span>
            </div>
            <button onClick={fetchLogs} className="flex items-center gap-1 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors">
              <RefreshCw size={14} /> 重試
            </button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm mt-6 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 z-10 flex justify-center items-center backdrop-blur-[1px] rounded-xl">
            <Activity className="animate-spin text-indigo-500" size={32} />
          </div>
        )}
        <CardHeader className="flex flex-row justify-between items-center border-b border-slate-100 pb-4">
          <CardTitle className="text-slate-800">近期操作紀錄</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜尋管理員或操作..." 
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button 
              onClick={handleSearch}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              搜尋
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">時間</th>
                  <th className="px-6 py-4 font-semibold">管理員</th>
                  <th className="px-6 py-4 font-semibold">操作類型</th>
                  <th className="px-6 py-4 font-semibold">目標對象</th>
                  <th className="px-6 py-4 font-semibold">詳細資訊</th>
                  <th className="px-6 py-4 font-semibold">IP 位址</th>
                  <th className="px-6 py-4 font-semibold">狀態</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      找不到符合條件的日誌
                    </td>
                  </tr>
                )}
                {logs.map((log, idx) => (
                  <tr key={log.id} className={`bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx === logs.length - 1 ? 'border-none' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{log.timestamp}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{log.admin}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-medium text-xs rounded-md border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{log.target}</td>
                    <td className="px-6 py-4 text-slate-600">{log.details}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{log.ip}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${log.status === 'SUCCESS' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                        {log.status}
                      </span>
                    </td>
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
