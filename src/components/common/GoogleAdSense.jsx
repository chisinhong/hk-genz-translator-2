import React, { useEffect } from 'react';

const GoogleAdSense = ({ adSlot, adFormat = 'auto', style }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('AdSense 錯誤:', error);
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive="true"
    />
  );
};

export default GoogleAdSense;
