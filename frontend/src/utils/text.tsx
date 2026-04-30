import React from 'react';

/**
 * Regex to match emergency numbers: 
 * - 3-4 digit shortcodes (100, 101, 108, 112, 1078)
 * - Standard Indian 10-digit numbers or with +91
 */
const PHONE_REGEX = /(\b100\b|\b101\b|\b108\b|\b112\b|\b1078\b|\+?91[ -]?\d{10}|\b\d{10}\b|\b\d{3}-\d{8}\b)/g;

export const formatEmergencyText = (text: string) => {
  if (!text) return text;

  const parts = text.split(PHONE_REGEX);
  
  return parts.map((part, index) => {
    if (PHONE_REGEX.test(part)) {
      return (
        <span 
          key={index} 
          className="text-accent-secondary font-bold underline decoration-accent-secondary/30 bg-accent-secondary/10 px-1 rounded mx-0.5"
        >
          {part}
        </span>
      );
    }
    return part;
  });
};
