import React from 'react';
import { useContribution } from '../utils/ContributionContext';

export default function Footer() {
  const { openModal } = useContribution();
  const footerSections = [
    {
      title: 'HK GenZ翻譯器',
      content: [
        {
          type: 'text',
          label: '專為香港年輕人打造的智能潮語翻譯平台',
        },
      ],
    },
    {
      title: '功能',
      content: [
        { type: 'link', label: '即時翻譯', href: '#' },
        { type: 'button', label: '貢獻新詞', onClick: openModal },
        { type: 'link', label: '詞典典藏', href: '#' },
      ],
    },
    {
      title: '關於我們',
      content: [
        { type: 'link', label: '關於我們', href: '#' },
        { type: 'link', label: '聯絡我們', href: '#' },
        { type: 'link', label: '服務條款', href: '#' },
      ],
    },
    {
      title: '追蹤我們',
      social: [
        { label: 'Threads', href: '#' },
        { label: 'Instagram', href: '#' },
        { label: 'Telegram', href: '#' },
      ],
    },
  ];

  return (
    <footer className="bg-black/20 mt-20 p-8">
      <div className="container mx-auto grid md:grid-cols-4 gap-8 text-left">
        {footerSections.map((section, idx) => (
          <div key={idx}>
            <h4 className="font-bold mb-2 text-lg">{section.title}</h4>

            {/* 一般內容 */}
            {section.content &&
              section.content.map((item, i) => {
                if (item.type === 'text') {
                  return (
                    <p key={i} className="text-sm text-gray-300">
                      {item.label}
                    </p>
                  );
                }
                if (item.type === 'link') {
                  return (
                    <a
                      key={i}
                      href={item.href}
                      className="block text-sm text-gray-300 hover:text-white"
                    >
                      {item.label}
                    </a>
                  );
                }
                if (item.type === 'button') {
                  return (
                    <button
                      key={i}
                      onClick={item.onClick || openModal}
                      className="block text-sm text-gray-300 hover:text-white bg-transparent border-none text-left p-0"
                    >
                      {item.label}
                    </button>
                  );
                }
                return null;
              })}

            {/* Social links */}
            {section.social && (
              <div className="flex space-x-4">
                {section.social.map((s, j) => (
                  <a
                    key={j}
                    href={s.href}
                    className="text-gray-300 hover:text-white"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="container mx-auto text-center mt-8 border-t border-gray-700 pt-4">
        <p className="text-sm text-gray-400">
          &copy; 2025 HK GenZ Translator. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
