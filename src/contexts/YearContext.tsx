import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { computeCurrentFYLabel, computeCurrentAYLabel, findClosestLabel } from '../lib/yearUtils';
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

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [assessmentYears, setAssessmentYears] = useState<AssessmentYear[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [currentLabel] = useState(() => computeCurrentFYLabel());
  const [autoFY, setAutoFY] = useState(currentLabel);
  const [autoAY, setAutoAY] = useState(() => computeCurrentAYLabel());
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
        setAutoFY(findClosestLabel(fyData.map(y => y.label), currentLabel));
        setAutoAY(findClosestLabel(ayData.map(y => y.label), computeCurrentAYLabel()));
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

function readStoredOverride(key: string): string | null {
  return localStorage.getItem(key);
}

function writeStoredOverride(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}
