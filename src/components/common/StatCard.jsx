import React from 'react';

const StatCard = ({ icon, value, label, percentage }) => (
  <div className="bg-[rgba(255,255,255,0.1)] backdrop-blur-sm p-4 md:p-6 rounded-2xl flex flex-col items-center text-center w-full">
    <div className="text-4xl mb-2">{icon}</div>
    <p className="text-2xl md:text-3xl font-bold">{value}</p>
    <p className="text-sm text-gray-200">{label}</p>
    {percentage && (
      <p
        className={`text-xs mt-1 ${
          percentage.startsWith('+') ? 'text-green-300' : 'text-red-300'
        }`}
      >
        {percentage}
      </p>
    )}
  </div>
);

export default StatCard;
