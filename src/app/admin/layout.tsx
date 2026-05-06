import React from 'react';
import Link from 'next/link';
import { Activity, Users, BarChart2, ShieldAlert, Settings, Hexagon } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar - Using brand colors (Indigo/Slate) */}
      <aside className="w-64 bg-slate-900 text-slate-300 shadow-xl flex flex-col transition-all duration-300">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg text-white">
            <Hexagon size={24} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Admin System</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200 group">
            <Activity size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium">即時監控 (Dashboard)</span>
          </Link>
          <Link href="/admin/users" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200 group">
            <Users size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium">用戶與介紹人查詢</span>
          </Link>
          <Link href="/admin/analytics" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200 group">
            <BarChart2 size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium">語言與投注分析</span>
          </Link>
          <Link href="/admin/secure-audit-logs" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200 group">
            <ShieldAlert size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium">系統安全日誌</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center space-x-3 p-3 w-full rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all duration-200">
            <Settings size={20} />
            <span className="font-medium">登出 (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10 p-5 flex justify-between items-center border-b border-slate-200">
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">管理員控制台</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium text-indigo-700">Role: Super Admin</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 lg:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
