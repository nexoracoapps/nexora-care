'use client';

import { createContext, useContext, useState, useRef } from 'react';

interface MusicContextValue {
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  muteForCall: () => void;
  unmuteAfterCall: () => void;
}

const MusicContext = createContext<MusicContextValue>({
  isMuted: false,
  setIsMuted: () => {},
  muteForCall: () => {},
  unmuteAfterCall: () => {},
});

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  const wasPlayingRef = useRef(false);

  const muteForCall = () => {
    wasPlayingRef.current = !isMuted;
    if (!isMuted) setIsMuted(true);
  };

  const unmuteAfterCall = () => {
    if (wasPlayingRef.current) setIsMuted(false);
    wasPlayingRef.current = false;
  };

  return (
    <MusicContext.Provider value={{ isMuted, setIsMuted, muteForCall, unmuteAfterCall }}>
      {children}
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
