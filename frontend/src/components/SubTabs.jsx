import React from 'react';

export default function SubTabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '2px solid var(--border)',
      background: 'var(--card)',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      flexShrink: 0,
    }}>
      {tabs.map((label, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            flex: 'none',
            padding: '9px 14px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
            background: 'none',
            border: 'none',
            borderBottom: active === i ? '2px solid var(--sage)' : '2px solid transparent',
            marginBottom: -2,
            color: active === i ? 'var(--sage)' : 'var(--muted)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
