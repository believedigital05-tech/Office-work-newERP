import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AssessmentYear, FinancialYear } from '../types';

interface YearContextValue {
  assessmentYears: AssessmentYear[];
  financialYears: FinancialYear[];
  selectedAY: string;
  selectedFY: string;
  setSelectedAY: (val: string | null) => void;
  setSelectedFY: (val: string | null) => void;
  autoAY: string;
  autoFY: string;
  isManualAY: boolean;
  isManualFY: boolean;
  resetToAuto: () => void;
  loading: boolean;
}

const YearContext = createContext<YearContextValue | null>(null);

const AY_STORAGE_KEY = 'manualAY';
const FY_STORAGE_KEY = 'manualFY';

function computeCurrentYearLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  if (now.getMonth() >= 3) {
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  }
  return `${year - 1}-${String(year % 100).padStart(2, '0')}`;
}

function findClosestLabel(labels: string[], target: string): string {
  if (labels.length === 0 || labels.includes(target)) return target;
  const targetStart = parseInt(target.slice(0, 4), 10);
  let best = labels[0];
  let bestDiff = Infinity;
  for (const label of labels) {
    const diff = Math.abs(parseInt(label.slice(0, 4), 10) - targetStart);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return best;
}

function readStoredOverride(key: string): string | null {
  return localStorage.getItem(key);
}

function writeStoredOverride(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [assessmentYears, setAssessmentYears] = useState<AssessmentYear[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [currentLabel] = useState(computeCurrentYearLabel);
  const [autoAY, setAutoAY] = useState(currentLabel);
  const [autoFY, setAutoFY] = useState(currentLabel);
  const [manualAY, setManualAY] = useState<string | null>(() => readStoredOverride(AY_STORAGE_KEY));
  const [manualFY, setManualFY] = useState<string | null>(() => readStoredOverride(FY_STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('assessment_years').select('*').order('start_year', { ascending: false }),
      supabase.from('financial_years').select('*').order('start_year', { ascending: false }),
    ])
      .then(([ayRes, fyRes]) => {
        const ayData = (ayRes.data ?? []) as AssessmentYear[];
        const fyData = (fyRes.data ?? []) as FinancialYear[];
        setAssessmentYears(ayData);
        setFinancialYears(fyData);
        setAutoAY(findClosestLabel(ayData.map(y => y.label), currentLabel));
        setAutoFY(findClosestLabel(fyData.map(y => y.label), currentLabel));
      })
      .finally(() => setLoading(false));
  }, [currentLabel]);

  const setSelectedAY = useCallback((val: string | null) => {
    writeStoredOverride(AY_STORAGE_KEY, val);
    setManualAY(val);
  }, []);

  const setSelectedFY = useCallback((val: string | null) => {
    writeStoredOverride(FY_STORAGE_KEY, val);
    setManualFY(val);
  }, []);

  const resetToAuto = useCallback(() => {
    setSelectedAY(null);
    setSelectedFY(null);
  }, [setSelectedAY, setSelectedFY]);

  return (
    <YearContext.Provider value={{
      assessmentYears,
      financialYears,
      selectedAY: manualAY ?? autoAY,
      selectedFY: manualFY ?? autoFY,
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
