'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface ThemeDef {
  label: string;
  labelAr: string;
  swatch: [string, string];
  vars: Record<string, string>;
}

export const THEMES: Record<string, ThemeDef> = {
  rose: {
    label: 'Rose', labelAr: 'وردي', swatch: ['#C4788C', '#7B5EA8'],
    vars: { '--rose': '#C4788C', '--rose-light': '#b05268', '--rose-dark': '#A05870', '--plum': '#7B5EA8', '--plum-light': '#5c408e', '--rose-rgb': '196,120,140', '--plum-rgb': '123,94,168', '--grad': 'linear-gradient(135deg, #C4788C, #7B5EA8)', '--border-rose': 'rgba(196,120,140,0.28)', '--shadow-rose': '0 4px 22px rgba(196,120,140,0.22)', '--bg': '#f9f3f6', '--bg-surface': '#ffffff', '--bg-elevated': '#edd8e4', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#0d060f', '--text-muted': '#3d2840', '--text-sub': '#7a6080', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  ocean: {
    label: 'Ocean', labelAr: 'محيطي', swatch: ['#2E86AB', '#1D5F8A'],
    vars: { '--rose': '#2E86AB', '--rose-light': '#1a6a8e', '--rose-dark': '#1E7A9E', '--plum': '#1D5F8A', '--plum-light': '#124870', '--rose-rgb': '46,134,171', '--plum-rgb': '29,95,138', '--grad': 'linear-gradient(135deg, #2E86AB, #1D5F8A)', '--border-rose': 'rgba(46,134,171,0.28)', '--shadow-rose': '0 4px 22px rgba(46,134,171,0.22)', '--bg': '#f0f7fc', '--bg-surface': '#ffffff', '--bg-elevated': '#cce4f2', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#060e14', '--text-muted': '#1e3a4a', '--text-sub': '#4a6e80', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'DM Sans', sans-serif" },
  },
  forest: {
    label: 'Forest', labelAr: 'غابة', swatch: ['#4A8C5C', '#7A6010'],
    vars: { '--rose': '#4A8C5C', '--rose-light': '#2f7044', '--rose-dark': '#3A6E45', '--plum': '#7A6010', '--plum-light': '#5c4808', '--rose-rgb': '74,140,92', '--plum-rgb': '122,96,16', '--grad': 'linear-gradient(135deg, #4A8C5C, #7A6010)', '--border-rose': 'rgba(74,140,92,0.28)', '--shadow-rose': '0 4px 22px rgba(74,140,92,0.22)', '--bg': '#f0f7f2', '--bg-surface': '#ffffff', '--bg-elevated': '#c8e2d0', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#060e08', '--text-muted': '#1e3a22', '--text-sub': '#4a6e50', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Nunito', sans-serif" },
  },
  sunset: {
    label: 'Sunset', labelAr: 'غروب', swatch: ['#D4754B', '#B8455A'],
    vars: { '--rose': '#C96040', '--rose-light': '#a84830', '--rose-dark': '#A84E30', '--plum': '#A83450', '--plum-light': '#8c2240', '--rose-rgb': '201,96,64', '--plum-rgb': '168,52,80', '--grad': 'linear-gradient(135deg, #C96040, #A83450)', '--border-rose': 'rgba(201,96,64,0.28)', '--shadow-rose': '0 4px 22px rgba(201,96,64,0.22)', '--bg': '#fdf5ef', '--bg-surface': '#ffffff', '--bg-elevated': '#f4d0bc', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#0f0604', '--text-muted': '#3e1e10', '--text-sub': '#7a5040', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  gold: {
    label: 'Gold', labelAr: 'ذهبي', swatch: ['#C9A96E', '#8B6914'],
    vars: { '--rose': '#B8922A', '--rose-light': '#9a7818', '--rose-dark': '#A0843A', '--plum': '#7A5A10', '--plum-light': '#604408', '--rose-rgb': '184,146,42', '--plum-rgb': '122,90,16', '--grad': 'linear-gradient(135deg, #B8922A, #7A5A10)', '--border-rose': 'rgba(184,146,42,0.28)', '--shadow-rose': '0 4px 22px rgba(184,146,42,0.22)', '--bg': '#fdf8ee', '--bg-surface': '#ffffff', '--bg-elevated': '#eeddbc', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#0a0804', '--text-muted': '#3a2e10', '--text-sub': '#6e5e30', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Playfair Display', serif" },
  },
  sapphire: {
    label: 'Sapphire', labelAr: 'ياقوت', swatch: ['#2d40c4', '#17bcd8'],
    vars: { '--rose': '#2d40c4', '--rose-light': '#1a2ea8', '--rose-dark': '#2030b0', '--plum': '#17bcd8', '--plum-light': '#0e9eb8', '--rose-rgb': '45,64,196', '--plum-rgb': '23,188,216', '--grad': 'linear-gradient(135deg, #2d40c4, #17bcd8)', '--border-rose': 'rgba(45,64,196,0.28)', '--shadow-rose': '0 4px 22px rgba(45,64,196,0.22)', '--bg': '#f0f3ff', '--bg-surface': '#ffffff', '--bg-elevated': '#ccd6fc', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#060814', '--text-muted': '#1a2050', '--text-sub': '#405090', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  crimson: {
    label: 'Crimson', labelAr: 'قرمزي', swatch: ['#dc2626', '#9f1239'],
    vars: { '--rose': '#dc2626', '--rose-light': '#b91c1c', '--rose-dark': '#c01c1c', '--plum': '#9f1239', '--plum-light': '#881030', '--rose-rgb': '220,38,38', '--plum-rgb': '159,18,57', '--grad': 'linear-gradient(135deg, #dc2626, #9f1239)', '--border-rose': 'rgba(220,38,38,0.28)', '--shadow-rose': '0 4px 22px rgba(220,38,38,0.22)', '--bg': '#fff3f3', '--bg-surface': '#ffffff', '--bg-elevated': '#fac8c8', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#0f0404', '--text-muted': '#4a0e0e', '--text-sub': '#8a3a3a', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  amber: {
    label: 'Amber', labelAr: 'كهرماني', swatch: ['#ea580c', '#d97706'],
    vars: { '--rose': '#ea580c', '--rose-light': '#c2410c', '--rose-dark': '#c84008', '--plum': '#d97706', '--plum-light': '#b45309', '--rose-rgb': '234,88,12', '--plum-rgb': '217,119,6', '--grad': 'linear-gradient(135deg, #ea580c, #d97706)', '--border-rose': 'rgba(234,88,12,0.28)', '--shadow-rose': '0 4px 22px rgba(234,88,12,0.22)', '--bg': '#fdf7ee', '--bg-surface': '#ffffff', '--bg-elevated': '#f8d8b0', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#0f0602', '--text-muted': '#431c04', '--text-sub': '#7c4214', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  emerald: {
    label: 'Emerald', labelAr: 'زمردي', swatch: ['#059669', '#065f46'],
    vars: { '--rose': '#059669', '--rose-light': '#047857', '--rose-dark': '#047350', '--plum': '#065f46', '--plum-light': '#044e38', '--rose-rgb': '5,150,105', '--plum-rgb': '6,95,70', '--grad': 'linear-gradient(135deg, #059669, #065f46)', '--border-rose': 'rgba(5,150,105,0.28)', '--shadow-rose': '0 4px 22px rgba(5,150,105,0.22)', '--bg': '#f0faf5', '--bg-surface': '#ffffff', '--bg-elevated': '#b4e4c8', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#040f09', '--text-muted': '#0a3520', '--text-sub': '#2a6845', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  summer: {
    label: 'Summer', labelAr: 'صيفي', swatch: ['#f4845f', '#4ecdc4'],
    vars: { '--rose': '#e8623a', '--rose-light': '#c94c24', '--rose-dark': '#d05028', '--plum': '#2dbfb8', '--plum-light': '#1ea49e', '--rose-rgb': '232,98,58', '--plum-rgb': '45,191,184', '--grad': 'linear-gradient(135deg, #f4845f, #4ecdc4)', '--border-rose': 'rgba(232,98,58,0.28)', '--shadow-rose': '0 4px 22px rgba(232,98,58,0.22)', '--bg': '#fdf5ee', '--bg-surface': '#fffaf7', '--bg-elevated': '#f8d0b4', '--bg-card': 'rgba(255,250,247,0.95)', '--text': '#0f0602', '--text-muted': '#4a1a08', '--text-sub': '#8a4e30', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
  nexora: {
    label: 'Nexora', labelAr: 'نيكسورا', swatch: ['#E63B2E', '#2D40C4'],
    vars: { '--rose': '#E63B2E', '--rose-light': '#c42a1e', '--rose-dark': '#cc3020', '--plum': '#2D40C4', '--plum-light': '#1a2ea8', '--rose-rgb': '230,59,46', '--plum-rgb': '45,64,196', '--grad': 'linear-gradient(135deg, #E63B2E, #2D40C4)', '--border-rose': 'rgba(230,59,46,0.28)', '--shadow-rose': '0 4px 22px rgba(230,59,46,0.22)', '--bg': '#f5f5fc', '--bg-surface': '#ffffff', '--bg-elevated': '#dde0f8', '--bg-card': 'rgba(255,255,255,0.92)', '--text': '#080810', '--text-muted': '#1a1a40', '--text-sub': '#505090', '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)', '--font': "'Inter', sans-serif" },
  },
};

function themeKey(username?: string | null) {
  return `theme_${username || 'guest'}`;
}

function applyTheme(name: string) {
  const t = THEMES[name] || THEMES.rose;
  const defaults: Record<string, string> = {
    '--text': '#0d060f', '--text-muted': '#3d2840', '--text-sub': '#7a6080',
    '--border': 'rgba(0,0,0,0.09)', '--border-strong': 'rgba(0,0,0,0.17)',
    '--bg-hover': 'rgba(0,0,0,0.04)',
  };
  Object.entries({ ...defaults, ...t.vars }).forEach(([k, v]) =>
    document.documentElement.style.setProperty(k, v)
  );
}

interface ThemeContextValue {
  theme: string;
  setTheme: (name: string) => void;
  syncUser: (username: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'nexora';
    try {
      const uname = localStorage.getItem('username') || sessionStorage.getItem('username');
      if (uname) {
        const stored = localStorage.getItem(`theme_${uname}`);
        if (stored && THEMES[stored]) { applyTheme(stored); return stored; }
      }
    } catch {}
    const t = localStorage.getItem('theme_guest') || 'nexora';
    applyTheme(t);
    return t;
  });

  const syncUser = useCallback((uname: string | null) => {
    setUsername(uname);
    const t = localStorage.getItem('theme_guest') || 'nexora';
    if (uname) localStorage.setItem(themeKey(uname), t);
    applyTheme(t);
    setThemeState(t);
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((name: string) => {
    localStorage.setItem(themeKey(username), name);
    localStorage.setItem('theme_guest', name);
    applyTheme(name);
    setThemeState(name);
  }, [username]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, syncUser }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
