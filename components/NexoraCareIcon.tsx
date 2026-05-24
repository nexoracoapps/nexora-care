'use client';

import { useId } from 'react';

export default function NexoraCareIcon({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  const bgId = `ncb${uid}`;
  const ltId = `ncl${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Hexagon body */}
      <path d="M20 2L35 10.5V29.5L20 38L5 29.5V10.5Z" fill="#12092A" />
      {/* Gradient border */}
      <path d="M20 2L35 10.5V29.5L20 38L5 29.5V10.5Z" stroke={`url(#${bgId})`} strokeWidth="1.5" />
      {/* N letter */}
      <path d="M13 27V13L27 27V13" stroke={`url(#${ltId})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id={bgId} x1="5" y1="2" x2="35" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4788C" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7B5EA8" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={ltId} x1="13" y1="13" x2="27" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0B4C4" />
          <stop offset="1" stopColor="#C5AFED" />
        </linearGradient>
      </defs>
    </svg>
  );
}
