import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AssessmentYear, FinancialYear } from '../types';

interface YearContextValue {
  assessmentYears: AssessmentYear[];
  financialYears: FinancialYear[];
  selectedAY: string;
  selectedFY: string;
  setSelectedAY: (val: string) => void;
  setSelectedFY: (val: string) => void;
  autoAY: string;
  autoFY: string;
  isManualAY: boolean;
  isManualFY: boolean;
  resetToAuto: () => void;
  loading: boolean;
}

const YearContext = createContext<YearContextValue | null>(null);

function computeAutoAY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (month >= 3) {
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  }
  return `${year - 1}-${String(year % 100).padStart(2, '0')}`;
}

function computeAutoFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (month >= 3) {
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  }
  return `${year - 1}-${String(year % 100).padStart(2, '0')}`;
}

function findClosestLabel(labels: string[], target: string): string {
  if (labels.length === 0) return target;
  if (labels.includes(target)) return target;
  const targetStart = parseInt(target.slice(0, 4));
  let best = labels[0];
  let bestDiff = Infinity;
  for (const label of labels) {
    const start = parseInt(label.slice(0, 4));
    const diff = Math.abs(start - targetStart);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return best;
}

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [assessmentYears, setAssessmentYears] = useState<AssessmentYear[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [autoAY, setAutoAY] = useState(computeAutoAY());
  const [autoFY, setAutoFY] = useState(computeAutoFY());
  const [manualAY, setManualAY] = useState<string | null>(null);
  const [manualFY, setManualFY] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAY = localStorage.getItem('manualAY');
    const storedFY = localStorage.getItem('manualFY');
    if (storedAY) setManualAY(storedAY);
    if (storedFY) setManualFY(storedFY);
  }, []);

  useEffect(() => {
    if (manualAY !== null) localStorage.setItem('manualAY', manualAY);
  }, [manualAY]);

  useEffect(() => {
    if (manualFY !== null) localStorage.setItem('manualFY', manualFY);
  }, [manualFY]);

  useEffect(() => {
    Promise.all([
      supabase.from('assessment_years').select('*').order('start_year', { ascending: false }),
      supabase.from('financial_years').select('*').order('start_year', { ascending: false }),
    ]).then(([ayRes, fyRes]) => {
      const ayData = (ayRes.data ?? []) as AssessmentYear[];
      const fyData = (fyRes.data ?? []) as FinancialYear[];
      setAssessmentYears(ayData);
      setFinancialYears(fyData);

      const ayLabels = ayData.map(y => y.label);
      const fyLabels = fyData.map(y => y.label);
      const computedAY = computeAutoAY();
      const computedFY = computeAutoFY();
      setAutoAY(findClosestLabel(ayLabels, computedAY));
      setAutoFY(findClosestLabel(fyLabels, computedFY));
      setLoading(false);
    });
  }, []);

  const setSelectedAY = useCallback((val: string) => setManualAY(val), []);
  const setSelectedFY = useCallback((val: string) => setManualFY(val), []);

  const resetToAuto = useCallback(() => {
    setManualAY(null);
    setManualFY(null);
    localStorage.removeItem('manualAY');
    localStorage.removeItem('manualFY');
  }, []);

  const selectedAY = manualAY ?? autoAY;
  const selectedFY = manualFY ?? autoFY;

  return (
    <YearContext.Provider value={{
      assessmentYears,
      financialYears,
      selectedAY,
      selectedFY,
      setSelectedAY,
      setSelectedFY,
      autoAY,
      autoFY,
      isManualAY: manualAY !== null,
      isManualFY: manualFY !== null,
      resetToAuto,
      loading,
    }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used within YearProvider');
  return ctx;
}
