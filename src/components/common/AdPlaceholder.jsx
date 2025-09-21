import React from 'react';

const AdPlaceholder = ({ title, className }) => (
  <div
    className={`flex items-center justify-center border-2 border-dashed border-gray-400 rounded-lg bg-[rgba(107,114,128,0.2)] ${className}`}
  >
    <p className="text-gray-300 text-sm">{title}</p>
  </div>
);

export default AdPlaceholder;
