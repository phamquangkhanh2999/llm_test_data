import React, { useState } from 'react';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({ text, maxLength = 230 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || text.length <= maxLength) {
    return <span>{text}</span>;
  }

  return (
    <div>
      <span>{isExpanded ? text : `${text.slice(0, maxLength)}...`}</span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          marginLeft: '8px',
          background: 'none',
          border: 'none',
          color: 'var(--color-teal)',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 'bold',
          padding: 0,
        }}
      >
        {isExpanded ? 'Thu nhỏ' : 'Xem thêm'}
      </button>
    </div>
  );
};
