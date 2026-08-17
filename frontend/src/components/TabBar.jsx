import React from 'react';

export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="tab-bar">
      {tabs.map((label, i) => (
        <button
          key={i}
          className={`tab-btn ${active === i ? 'active' : ''}`}
          onClick={() => onChange(i)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
