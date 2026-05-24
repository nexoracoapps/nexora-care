'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useMusic } from '@/context/MusicContext';

export default function MusicPlayer() {
  const { isMuted: muted, setIsMuted: setMuted } = useMusic();
  const [playing, setPlaying] = useState(false);
  const startedRef = useRef(false);
  const ctxRef     = useRef<AudioContext | null>(null);
  const masterRef  = useRef<GainNode | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildGraph = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;

    const ctx: AudioContext = new AC();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.13, ctx.currentTime);
    master.connect(ctx.destination);
    masterRef.current = master;

    const delay   = ctx.createDelay(3.0);
    const fbGain  = ctx.createGain();
    const outGain = ctx.createGain();
    const hp      = ctx.createBiquadFilter();
    delay.delayTime.setValueAtTime(0.55, ctx.currentTime);
    fbGain.gain.setValueAtTime(0.20, ctx.currentTime);
    outGain.gain.setValueAtTime(0.28, ctx.currentTime);
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(320, ctx.currentTime);
    delay.connect(fbGain);
    fbGain.connect(hp);
    hp.connect(delay);
    delay.connect(outGain);
    outGain.connect(master);

    const playChime = (freq: number, vol: number, dur: number, pan = 0) => {
      const now = ctx.currentTime;
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      panner.connect(delay);
      panner.connect(master);

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const o3 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();
      const g3 = ctx.createGain();

      o1.type = 'triangle';
      o2.type = 'sine';
      o3.type = 'sine';
      o1.frequency.setValueAtTime(freq, now);
      o2.frequency.setValueAtTime(freq * 2.756, now);
      o3.frequency.setValueAtTime(freq * 0.998, now);

      const atk = 0.005 + Math.random() * 0.008;
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(vol, now + atk);
      g1.gain.exponentialRampToValueAtTime(0.001, now + dur);
      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(vol * 0.22, now + atk);
      g2.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.35);
      g3.gain.setValueAtTime(0, now);
      g3.gain.linearRampToValueAtTime(vol * 0.08, now + atk);
      g3.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.6);

      o1.connect(g1); g1.connect(panner);
      o2.connect(g2); g2.connect(panner);
      o3.connect(g3); g3.connect(panner);
      [o1, o2, o3].forEach(o => { o.start(now); o.stop(now + dur + 0.1); });
    };

    const NOTES = [
      261.63, 329.63, 392.00, 440.00, 523.25,
      659.25, 783.99, 880.00, 1046.50, 1318.51,
    ];

    const playSequence = () => {
      const base = Math.floor(Math.random() * 6);
      const vol  = 0.038 + Math.random() * 0.028;
      [0, 1, 2].forEach((i) => {
        setTimeout(() => {
          if (ctxRef.current) {
            const pan = (Math.random() - 0.5) * 0.6;
            playChime(NOTES[base + i], vol * (1 - i * 0.18), 1.6 + i * 0.4, pan);
          }
        }, i * (180 + Math.random() * 120));
      });
    };

    const schedule = () => {
      const freq = NOTES[Math.floor(Math.random() * NOTES.length)];
      const dur  = 1.8 + Math.random() * 2.2;
      const vol  = 0.04 + Math.random() * 0.05;
      const pan  = (Math.random() - 0.5) * 0.7;
      playChime(freq, vol, dur, pan);
      if (Math.random() > 0.72) {
        setTimeout(() => { if (ctxRef.current) playSequence(); }, 300 + Math.random() * 600);
      }
      timerRef.current = setTimeout(schedule, 700 + Math.random() * 1600);
    };

    schedule();
    setPlaying(true);
  }, []);

  const startAudio = useCallback(() => {
    if (startedRef.current) {
      if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
      return;
    }
    buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    // Try immediate autoplay (works when navigated via link click)
    buildGraph();

    // If browser blocked it, reset and restart on first real interaction
    if (ctxRef.current?.state !== 'running') {
      if (timerRef.current) clearTimeout(timerRef.current);
      try { ctxRef.current?.close(); } catch (_) {}
      ctxRef.current = null;
      masterRef.current = null;
      startedRef.current = false;

      const events = ['click', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;
      const onInteraction = () => {
        events.forEach(ev => document.removeEventListener(ev, onInteraction));
        if (!startedRef.current) buildGraph();
      };
      events.forEach(ev => document.addEventListener(ev, onInteraction, { once: true, passive: true }));
      return () => events.forEach(ev => document.removeEventListener(ev, onInteraction));
    }
  }, [buildGraph]);

  useEffect(() => {
    if (!masterRef.current || !ctxRef.current) return;
    masterRef.current.gain.setTargetAtTime(muted ? 0 : 0.13, ctxRef.current.currentTime, 0.5);
  }, [muted]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      try { ctxRef.current?.close(); } catch (_) {}
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    startAudio(); // ensure audio starts if button is first interaction
    if (startedRef.current) setMuted(v => !v);
  };
  const active = playing && !muted;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .mp-btn {
          position: fixed;
          bottom: calc(20px + env(safe-area-inset-bottom, 0px));
          right:  calc(20px + env(safe-area-inset-right,  0px));
          width: 46px; height: 46px; border-radius: 50%;
          background: rgba(255,255,255,0.90);
          border: 1px solid rgba(var(--rose-rgb),0.30);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 24px rgba(0,0,0,0.50);
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          z-index: 9999; outline: none;
          transition: transform 0.18s, box-shadow 0.22s, border-color 0.22s;
        }
        .mp-btn:hover {
          transform: scale(1.12);
          box-shadow: 0 8px 30px rgba(var(--rose-rgb),0.35), 0 0 0 4px rgba(var(--rose-rgb),0.08);
          border-color: rgba(var(--rose-rgb),0.55);
        }
        .mp-btn.playing { animation: mp-pulse 4s ease-in-out infinite; }
        @keyframes mp-pulse {
          0%,100% { box-shadow: 0 6px 24px rgba(0,0,0,0.50), 0 0 0 0   rgba(var(--rose-rgb),0.22); }
          50%      { box-shadow: 0 6px 24px rgba(0,0,0,0.50), 0 0 0 10px rgba(var(--rose-rgb),0); }
        }
        .mp-eq { display: flex; align-items: flex-end; gap: 3px; height: 20px; padding-bottom: 1px; }
        .mp-bar {
          width: 3px; border-radius: 3px;
          background: linear-gradient(to top, var(--rose-light), #e8c98a);
          transition: background 0.3s;
        }
        .mp-btn.muted .mp-bar { background: rgba(0,0,0,0.18); }
        .mp-eq.on .mp-bar:nth-child(1) { animation: eq1 1.1s ease-in-out infinite 0.00s; }
        .mp-eq.on .mp-bar:nth-child(2) { animation: eq1 1.1s ease-in-out infinite 0.22s; }
        .mp-eq.on .mp-bar:nth-child(3) { animation: eq1 1.1s ease-in-out infinite 0.44s; }
        .mp-eq.on .mp-bar:nth-child(4) { animation: eq1 1.1s ease-in-out infinite 0.66s; }
        @keyframes eq1 {
          0%,100% { height: 3px; }
          50%      { height: 16px; }
        }
        .mp-eq:not(.on) .mp-bar            { height: 3px; }
        .mp-eq:not(.on) .mp-bar:nth-child(2){ height: 9px; }
        .mp-eq:not(.on) .mp-bar:nth-child(3){ height: 6px; }
        .mp-muted-icon { font-size: 19px; line-height: 1; }
        @media (max-width: 480px) {
          .mp-btn { bottom: calc(14px + env(safe-area-inset-bottom, 0px)); right: calc(14px + env(safe-area-inset-right, 0px)); width: 42px; height: 42px; }
        }
      ` }} />

      <button
        className={`mp-btn${active ? ' playing' : ''}${muted ? ' muted' : ''}`}
        onClick={toggle}
        title={muted ? 'Unmute ambient music' : 'Mute ambient music'}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <span className="mp-muted-icon">🔇</span>
        ) : (
          <div className={`mp-eq${active ? ' on' : ''}`}>
            <div className="mp-bar" />
            <div className="mp-bar" />
            <div className="mp-bar" />
            <div className="mp-bar" />
          </div>
        )}
      </button>
    </>
  );
}
