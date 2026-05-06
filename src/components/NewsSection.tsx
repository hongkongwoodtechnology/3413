import React, { useState } from 'react';
import { ArrowRight, Newspaper } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { useLanguage } from '@/components/LanguageProvider';

interface NewsSectionProps {
  onBonusClick: () => void;
  onNewsDetailClick: () => void;
}

export function NewsSection({ onBonusClick, onNewsDetailClick }: NewsSectionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { t } = useLanguage();

  return (
    <section 
      className="relative w-full overflow-hidden bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl group transition-all duration-500 cursor-pointer"
      aria-label="Latest Promotion News"
      onClick={onNewsDetailClick}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-purple/20 via-neutral-900 to-primary-blue/10 z-0 transition-opacity duration-300 group-hover:opacity-80"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-purple/10 rounded-full blur-[120px] pointer-events-none transform translate-x-1/2 -translate-y-1/4"></div>

      {/* View All News Button (Top Right) */}
      <div className="absolute top-6 right-6 z-30">
        <button 
          onClick={(e) => {
              e.stopPropagation(); // 避免觸發外層的 onClick
              // TODO: 打開所有新聞列表
              onNewsDetailClick();
          }}
          className="group/btn flex items-center gap-2 bg-neutral-800/80 hover:bg-primary-purple text-neutral-300 hover:text-white px-5 py-2.5 rounded-xl border border-neutral-700 hover:border-primary-purple/50 transition-all duration-300 backdrop-blur-md min-h-[48px] min-w-[48px]"
          aria-label="View all news and promotions"
        >
          <Newspaper className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-bold tracking-wide">{t('news.all')}</span>
        </button>
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between min-h-[300px]">
        
        {/* Left Content Area: Typography & CTA */}
        <div className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-500/5 border border-orange-500/30 w-fit mb-6">
            <span className="flex w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span className="text-xs font-black text-orange-400 uppercase tracking-widest">{t('banner.limited_time')}</span>
          </div>

          {/* Headline (SEO Optimized) */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight mb-4 group-hover:text-primary-purple transition-colors duration-300">
            {t('banner.title.1')}<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-purple to-primary-blue">
              {t('banner.title.2')}
            </span>
          </h1>

          {/* Read More Indicator */}
          <div className="flex items-center gap-2 text-neutral-400 mt-4 group-hover:text-white transition-colors duration-300">
            <span className="text-sm font-bold">{t('banner.read_more')}</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-2 transition-transform duration-300" />
          </div>
        </div>
      </div>
    </section>
  );
}