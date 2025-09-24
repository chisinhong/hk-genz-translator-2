import React, { useEffect } from 'react';
import { Sparkles, Star, CheckCircle2, MessageCircleMore } from 'lucide-react';
import {
  trackUpgradeModalOpened,
  trackUpgradeModalClosed,
  trackUpgradeModalUpgradeClick,
  trackUpgradeModalSocialClick,
} from '../../utils/analytics';

const BENEFITS = [
  '每日翻譯額度倍增，毫無限制咁玩',
  '尊享更快回應同優先排隊',
  '解鎖獨家GenZ教學同語料包',
];

const SOCIAL_LINKS = [
  {
    label: '加入 IG 社群',
    url: 'https://instagram.com/',
    icon: <Sparkles size={16} />,
  },
  {
    label: '加入 Discord',
    url: 'https://discord.gg/',
    icon: <MessageCircleMore size={16} />,
  },
];

const UpgradeModal = ({ isOpen, onClose, onUpgrade, stats }) => {
  useEffect(() => {
    if (isOpen) {
      trackUpgradeModalOpened({
        remaining: stats?.remaining,
        limit: stats?.limit,
        limitType: stats?.limitType,
      });
    }
  }, [isOpen, stats]);

  if (!isOpen) {
    return null;
  }

  const handleUpgrade = () => {
    trackUpgradeModalUpgradeClick({
      remaining: stats?.remaining,
      limit: stats?.limit,
      limitType: stats?.limitType,
    });
    onUpgrade?.();
  };

  const handleClose = () => {
    trackUpgradeModalClosed({
      remaining: stats?.remaining,
      limit: stats?.limit,
      limitType: stats?.limitType,
    });
    onClose?.();
  };

  const handleSocialClick = (label, url) => {
    trackUpgradeModalSocialClick({ channel: label });
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-xl rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-8 shadow-2xl text-white">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-6 top-6 text-white/60 transition hover:text-white"
        >
          ✕
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-white/20 p-3">
            <Star className="text-yellow-300" size={28} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-white/60">
              今日翻譯額度用完咗
            </p>
            <h2 className="text-3xl font-bold">升級成為 VIP 翻譯玩家</h2>
          </div>
        </div>

        <p className="mb-6 text-white/80">
          升級後即可獲得無限翻譯次數、優先處理速度同更多潮語資源，持續同我哋一齊更新香港 GenZ 字典！
        </p>

        <div className="mb-6 rounded-2xl bg-black/20 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Sparkles size={18} className="text-yellow-300" /> 升級福利
          </h3>
          <ul className="space-y-2 text-white/85">
            {BENEFITS.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2 size={18} className="mt-1 flex-shrink-0 text-emerald-300" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={handleUpgrade}
            className="flex-1 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 py-3 text-base font-semibold text-purple-800 transition hover:brightness-110"
          >
            立即升級
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-white/40 py-3 text-base font-semibold text-white transition hover:bg-white/10"
          >
            之後先算
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 p-4">
          <p className="mb-3 text-sm font-semibold text-white/80">
            想同更多潮語玩家交流？
          </p>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => handleSocialClick(link.label, link.url)}
                className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/30"
              >
                {link.icon}
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
