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
      viewBox="-2 -2 52 52"
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect x="-2" y="-2" width="52" height="52" rx="11" fill="#12092A" />
      <path d="M24 2L43.0526 13.5V36.5L24 48L4.94744 36.5V13.5L24 2Z" fill={`url(#${bgId})`} opacity="0.15" />
      <path d="M24 2L43.0526 13.5V36.5L24 48L4.94744 36.5V13.5L24 2Z" stroke={`url(#${bgId})`} strokeWidth="1.5" fill="none" />
      <path d="M15 34V14L24 30V14" stroke={`url(#${bgId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 30L33 14V34" stroke={`url(#${ltId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="14" r="2" fill="#C4788C" />
      <circle cx="33" cy="34" r="2" fill="#9b5de5" />
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4788C" />
          <stop offset="0.55" stopColor="#e53e5a" />
          <stop offset="1" stopColor="#9b5de5" />
        </linearGradient>
        <linearGradient id={ltId} x1="48" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9b5de5" />
          <stop offset="1" stopColor="#C4788C" />
        </linearGradient>
      </defs>
    </svg>
  );
}
