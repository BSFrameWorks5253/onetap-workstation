import React from 'react';

interface HighlightMatchProps {
  text: string;
  query: string;
}

export const HighlightMatch: React.FC<HighlightMatchProps> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;

  const trimmed = query.trim();
  const regex = new RegExp(`(${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <span key={index} className="text-unidesk-gold font-semibold underline decoration-unidesk-gold/50">
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
};
