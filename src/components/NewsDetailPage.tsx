import React from 'react';
import { ArrowLeft, Calendar, ShieldCheck, Zap, Globe, ChevronRight } from 'lucide-react';

import { useLanguage } from '@/components/LanguageProvider';

interface NewsDetailPageProps {
  onBack: () => void;
  onGoToBonus: () => void;
}

export function NewsDetailPage({ onBack, onGoToBonus }: NewsDetailPageProps) {
  const { t } = useLanguage();
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      {/* Back Navigation */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" />
        <span className="font-bold">{t('news.detail.back_home')}</span>
      </button>

      {/* Article Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="px-3 py-1 bg-primary-purple/10 text-primary-purple border border-primary-purple/20 rounded-full text-xs font-bold uppercase tracking-wider">
            {t('news.detail.official')}
          </div>
          <div className="flex items-center gap-2 text-neutral-500 text-sm font-medium">
            <Calendar className="w-4 h-4" />
            <span>{t('news.detail.date')}2026-04-08</span>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6">
          {t('news.detail.title1')}<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-purple to-primary-blue">
            {t('news.detail.title2')}
          </span>
        </h1>
        <p className="text-xl text-neutral-400 leading-relaxed">
          {t('news.detail.intro')}
        </p>
      </header>

      {/* Article Featured Image Removed */}

      {/* Article Content */}
      <article className="prose prose-invert prose-lg max-w-none">
        
        <h2 className="text-2xl font-bold text-white mt-10 mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary-purple" />
          {t('news.detail.why')}
        </h2>
        <p className="text-neutral-300 leading-relaxed mb-6">
          {t('news.detail.why_desc')}
          <ul className="list-disc pl-6 mt-4 space-y-2 text-neutral-400">
            <li><strong className="text-white">{t('news.detail.feature1')}</strong> {t('news.detail.feature1_desc')}</li>
            <li><strong className="text-white">{t('news.detail.feature2')}</strong> {t('news.detail.feature2_desc')}</li>
            <li><strong className="text-white">{t('news.detail.feature3')}</strong> {t('news.detail.feature3_desc')}</li>
          </ul>
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary-blue" />
          {t('news.detail.security')}
        </h2>
        <p className="text-neutral-300 leading-relaxed mb-6">
          {t('news.detail.security_desc')}
        </p>

        <h2 className="text-2xl font-bold text-white mt-12 mb-4 flex items-center gap-2">
          <Globe className="w-6 h-6 text-green-400" />
          {t('news.detail.how')}
        </h2>
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-2xl p-6 md:p-8 my-8">
          <p className="text-neutral-300 leading-relaxed mb-6">
            {t('news.detail.how_intro')}
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-purple/20 text-primary-purple font-black flex items-center justify-center shrink-0 mt-1">1</div>
              <div>
                <h4 className="text-white font-bold text-lg m-0">{t('news.detail.step1')}</h4>
                <p className="text-neutral-400 m-0 mt-1">{t('news.detail.step1_desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-purple/20 text-primary-purple font-black flex items-center justify-center shrink-0 mt-1">2</div>
              <div>
                <h4 className="text-white font-bold text-lg m-0">{t('news.detail.step2')}</h4>
                <p className="text-neutral-400 m-0 mt-1">{t('news.detail.step2_desc')}<strong>3 USDT</strong>。</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 font-black flex items-center justify-center shrink-0 mt-1">3</div>
              <div>
                <h4 className="text-white font-bold text-lg m-0">{t('news.detail.step3')}</h4>
                <p className="text-neutral-400 m-0 mt-1">{t('news.detail.step3_desc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 pt-12 border-t border-neutral-800 text-center">
          <h3 className="text-3xl font-black text-white mb-6">{t('news.detail.ready')}</h3>
          <button 
            onClick={onGoToBonus}
            className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-primary-purple to-primary-blue text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(168,85,247,0.4)] hover:shadow-[0_0_60px_rgba(168,85,247,0.6)] transition-all duration-300 transform hover:-translate-y-2"
          >
            {t('news.claim_100')}
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </article>
    </div>
  );
}