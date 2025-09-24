import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const baseClass =
  'inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white/80 transition hover:bg-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

const BackButton = ({ className = '' }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`${baseClass} ${className}`.trim()}
    >
      <ArrowLeft size={16} /> 返回
    </button>
  );
};

export default BackButton;
