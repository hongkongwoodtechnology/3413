"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, ChevronDown, UserPlus, DollarSign, History, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all'); // all, user, referrer
  const [isMounted, setIsMounted] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(`/api/admin/users?type=${searchType}&search=${searchTerm}`);
      if (response.success) {
        setUsers(response.data);
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
    fetchUsers();
  }, [searchType]); // Refetch when type changes

  const handleSearch = () => {
    fetchUsers();
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
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">用戶與介紹人查詢系統</h2>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center justify-between text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} />
              <span>資料載入失敗: {error}</span>
            </div>
            <button onClick={fetchUsers} className="flex items-center gap-1 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors">
              <RefreshCw size={14} /> 重試
            </button>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜尋 用戶ID, 錢包地址 或 介紹人代碼..." 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 transition-shadow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <select 
                className="p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <option value="all">所有身份</option>
                <option value="user">一般用戶</option>
                <option value="referrer">介紹人 (KOL)</option>
              </select>

              <button className="flex items-center space-x-2 px-5 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors">
                <Filter size={18} />
                <span>進階篩選</span>
                <ChevronDown size={14} />
              </button>
              
              <button 
                onClick={handleSearch}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                {isLoading ? <Activity size={18} className="animate-spin" /> : null}
                搜尋
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User List Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-800">查詢結果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-slate-200 relative">
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 z-10 flex justify-center items-center backdrop-blur-[1px]">
                <Activity className="animate-spin text-indigo-500" size={32} />
              </div>
            )}
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">用戶 ID / 錢包</th>
                  <th className="px-6 py-4 font-semibold">身份</th>
                  <th className="px-6 py-4 font-semibold">介紹人代碼</th>
                  <th className="px-6 py-4 font-semibold">總投注額 (USDT)</th>
                  <th className="px-6 py-4 font-semibold">下線數 / 傭金</th>
                  <th className="px-6 py-4 font-semibold">加入時間</th>
                  <th className="px-6 py-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      找不到符合條件的資料
                    </td>
                  </tr>
                )}
                {users.map((user, idx) => (
                  <tr key={user.id} className={`bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx === users.length - 1 ? 'border-none' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{user.id}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{user.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${user.type === 'Referrer' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {user.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{user.refCode || '-'}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">${user.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {user.type === 'Referrer' ? (
                        <div className="text-sm space-y-1">
                          <div className="flex items-center space-x-1 text-indigo-600"><UserPlus size={14}/> <span className="font-medium">{user.downlines} 人</span></div>
                          <div className="flex items-center space-x-1 text-emerald-600"><DollarSign size={14}/> <span className="font-medium">${user.commission}</span></div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.joinedAt}</td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 font-medium transition-colors">
                        <History size={16} />
                        <span>詳細紀錄</span>
                      </button>
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
