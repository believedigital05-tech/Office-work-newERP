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
    minimized.find(w => w.id === id)?.onRestore();
    setMinimized(prev => prev.filter(w => w.id !== id));
  }, [minimized]);

  const remove = useCallback((id: string) => {
    setMinimized(prev => prev.filter(w => w.id !== id));
  }, []);

  return (
    <MinimizeContext.Provider value={{ minimized, minimize, restore, remove }}>
      {children}
    </MinimizeContext.Provider>
  );
}

export function useMinimize() {
  const ctx = useContext(MinimizeContext);
  if (!ctx) throw new Error('useMinimize must be used within MinimizeProvider');
  return ctx;
}
