import React, { createContext, useContext, useState, useCallback } from 'react';

export interface MinimizedWindow {
  id: string;
  title: string;
  icon?: React.ReactNode;
  onRestore: () => void;
}

interface MinimizeContextValue {
  minimized: MinimizedWindow[];
  minimize: (win: MinimizedWindow) => void;
  restore: (id: string) => void;
  remove: (id: string) => void;
  isMinimized: (id: string) => boolean;
}

const MinimizeContext = createContext<MinimizeContextValue | null>(null);

export function MinimizeProvider({ children }: { children: React.ReactNode }) {
  const [minimized, setMinimized] = useState<MinimizedWindow[]>([]);

  const minimize = useCallback((win: MinimizedWindow) => {
    setMinimized(prev => {
      if (prev.some(w => w.id === win.id)) return prev;
      return [...prev, win];
    });
  }, []);

  const restore = useCallback((id: string) => {
    setMinimized(prev => {
      const win = prev.find(w => w.id === id);
      if (win) win.onRestore();
      return prev.filter(w => w.id !== id);
    });
  }, []);

  const remove = useCallback((id: string) => {
    setMinimized(prev => prev.filter(w => w.id !== id));
  }, []);

  const isMinimized = useCallback((id: string) => {
    return minimized.some(w => w.id === id);
  }, [minimized]);

  return (
    <MinimizeContext.Provider value={{ minimized, minimize, restore, remove, isMinimized }}>
      {children}
    </MinimizeContext.Provider>
  );
}

export function useMinimize() {
  const ctx = useContext(MinimizeContext);
  if (!ctx) throw new Error('useMinimize must be used within MinimizeProvider');
  return ctx;
}
