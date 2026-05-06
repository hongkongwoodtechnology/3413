import React, { useState, useEffect, useMemo } from 'react';
import { Newspaper, Bell, Megaphone, Zap, ShieldAlert, ArrowLeft, CheckCircle2, ChevronRight, X, Loader2 } from 'lucide-react';

import { useLanguage } from '@/components/LanguageProvider';
import { getMockNews, NewsItem, NewsCategory } from '@/lib/mockNews';

// --- Types ---
export type { NewsCategory, NewsItem };

// --- Mock Data ---
// Replaced with dynamic mock data generator in src/lib/mockNews.ts

const CATEGORY_MAP = {
  all: { label: '全部', icon: Newspaper, color: 'text-neutral-400' },
  announcement: { label: '系統公告', icon: Megaphone, color: 'text-blue-400' },
  update: { label: '產品更新', icon: Zap, color: 'text-purple-400' },
  event: { label: '活動訊息', icon: Bell, color: 'text-orange-400' },
  maintenance: { label: '維護通知', icon: ShieldAlert, color: 'text-red-400' }
};

interface NewsCenterPageProps {
  onBack: () => void;
  onGoToBonus: () => void;
}

export function NewsCenterPage({ onBack, onGoToBonus }: NewsCenterPageProps) {
  const { t, language } = useLanguage();
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load mock data on language change
  useEffect(() => {
    setNewsList(getMockNews(language));
  }, [language]);

  // Filtered News
  const filteredNews = useMemo(() => {
    let result = newsList;
    if (activeCategory !== 'all') {
      result = result.filter(n => n.category === activeCategory);
    }
    // Sort: Pinned first, then by date desc
    return result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [newsList, activeCategory]);

  const selectedNews = useMemo(() => {
    return newsList.find(n => n.id === selectedNewsId) || null;
  }, [newsList, selectedNewsId]);

  const unreadCount = newsList.filter(n => n.isUnread).length;

  const handleReadNews = (id: string) => {
    setSelectedNewsId(id);
    // Mark as read
    setNewsList(prev => prev.map(n => n.id === id ? { ...n, isUnread: false } : n));
  };

  const handleMarkAllAsRead = () => {
    setNewsList(prev => prev.map(n => ({ ...n, isUnread: false })));
  };

  const handleLoadMore = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Mock loading more data
    }, 800);
  };

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 sm:px-6 lg:px-8 h-[calc(100vh-80px)] flex flex-col animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              {t('news.center')}
              {unreadCount > 0 && (
                <span className="text-xs font-bold bg-primary-purple text-white px-2 py-0.5 rounded-full animate-pulse">
                  {unreadCount} {t('news.unread')}
                </span>
              )}
            </h1>
            <p className="text-neutral-400 text-sm mt-1">{t('news.subtitle')}</p>
          </div>
        </div>

        {/* Categories / Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 custom-scrollbar mask-image-linear-right pr-4">
          {(Object.entries(CATEGORY_MAP) as [NewsCategory, any][]).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-neutral-800 text-white shadow-md border border-neutral-700' 
                    : 'bg-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? config.color : ''}`} />
                {t(`news.category.${key}`)}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Layout: Two Columns */}
      <div className="flex flex-1 gap-6 min-h-0 relative">
        
        {/* Left Column: News List */}
        <div className={`flex flex-col flex-1 bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${selectedNewsId ? 'hidden md:flex md:w-1/3 lg:w-1/3 shrink-0' : 'w-full'}`}>
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 backdrop-blur z-10 shrink-0">
            <span className="text-sm font-bold text-neutral-400">{t('news.total').replace('{count}', filteredNews.length.toString())}</span>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1.5 text-xs font-bold text-primary-purple hover:text-primary-purple/80 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('news.mark_all_read')}
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filteredNews.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-4">
                <Newspaper className="w-12 h-12 opacity-20" />
                <p>{t('news.empty')}</p>
              </div>
            ) : (
              <>
                {filteredNews.map(news => {
                  const CatIcon = CATEGORY_MAP[news.category].icon;
                  const isSelected = selectedNewsId === news.id;
                  
                  return (
                    <button
                      key={news.id}
                      onClick={() => handleReadNews(news.id)}
                      className={`w-full text-left p-4 rounded-2xl transition-all duration-200 border group ${
                        isSelected 
                          ? 'bg-neutral-800 border-neutral-700 shadow-inner' 
                          : 'bg-transparent border-transparent hover:bg-neutral-800/50 hover:border-neutral-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 shrink-0 ${CATEGORY_MAP[news.category].color}`}>
                          <CatIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-neutral-500">{t(`news.category.${news.category}`)}</span>
                            <span className="text-xs text-neutral-500">{news.date}</span>
                          </div>
                          <h3 className={`text-base font-bold truncate mb-1 pr-4 relative ${news.isUnread ? 'text-white' : 'text-neutral-300'}`}>
                            {news.title}
                            {news.isUnread && (
                              <span className="absolute right-0 top-1.5 w-2 h-2 rounded-full bg-primary-purple animate-pulse"></span>
                            )}
                          </h3>
                          <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">
                            {news.excerpt}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                
                {filteredNews.length > 0 && (
                  <button 
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="w-full py-4 mt-2 text-sm font-bold text-neutral-400 hover:text-white bg-neutral-800/30 hover:bg-neutral-800 rounded-2xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('news.load_more')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: News Detail (Slide-in / Expand) */}
        <div className={`flex-1 bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col relative ${!selectedNewsId ? 'hidden' : 'flex'}`}>
          {selectedNews ? (
            <>
              {/* Mobile Close Button */}
              <button 
                onClick={() => setSelectedNewsId(null)}
                className="md:hidden absolute top-4 right-4 z-50 w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 lg:p-16">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      selectedNews.category === 'event' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                      selectedNews.category === 'announcement' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      selectedNews.category === 'update' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                      'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      {React.createElement(CATEGORY_MAP[selectedNews.category].icon, { className: "w-3.5 h-3.5" })}
                      {t(`news.category.${selectedNews.category}`)}
                    </div>
                    <span className="text-neutral-500 text-sm font-medium">{selectedNews.date}</span>
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-8">
                    {selectedNews.title}
                  </h2>

                  {/* Render Image if Event */}
                  {selectedNews.category === 'event' && (
                    <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-10 border border-neutral-800 relative group cursor-pointer" onClick={onGoToBonus}>
                      <img 
                        src="https://images.unsplash.com/photo-1518605368461-1ee71e68d06b?q=80&w=2000&auto=format&fit=crop" 
                        alt="Event Banner"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent"></div>
                      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                         <span className="text-white font-bold text-xl drop-shadow-lg">{t('news.go_to_event')}</span>
                         <div className="w-10 h-10 rounded-full bg-primary-purple flex items-center justify-center text-white shadow-lg group-hover:bg-white group-hover:text-primary-purple transition-colors">
                           <ChevronRight className="w-6 h-6" />
                         </div>
                      </div>
                    </div>
                  )}

                  <div className="prose prose-invert prose-lg max-w-none text-neutral-300 whitespace-pre-wrap">
                    {selectedNews.content}
                  </div>
                  
                  {/* CTA for Event */}
                  {selectedNews.category === 'event' && (
                    <div className="mt-12 pt-8 border-t border-neutral-800 text-center">
                      <button 
                        onClick={onGoToBonus}
                        className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-primary-purple to-primary-blue text-white px-8 py-4 rounded-xl font-bold text-lg shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all duration-300 transform hover:-translate-y-1"
                      >
                        {t('news.claim_100')}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500">
              <Newspaper className="w-16 h-16 opacity-20 mb-4" />
              <p className="text-lg font-medium">{t('news.select_left')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}