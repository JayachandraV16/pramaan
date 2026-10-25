import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/workflow.api';
import { hi } from './hi';

export type Language = 'en' | 'hi';

const STORAGE_KEY = 'pramaan_language';
const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, hi };

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  /** t('key', 'English text', { n: 3 }) - English is the fallback and the source text; {n} placeholders are filled in. */
  t: (key: string, english: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function readStored(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

const fill = (text: string, params?: Record<string, string | number>) =>
  params ? text.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`)) : text;

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Language>(readStored);

  // A signed-in user's saved preference wins over the browser's last choice.
  useEffect(() => {
    const saved = (user as { preferred_language?: string } | null)?.preferred_language;
    if (saved === 'hi' || saved === 'en') {
      setLangState(saved);
      try {
        localStorage.setItem(STORAGE_KEY, saved);
      } catch {
        /* storage unavailable: keep in memory */
      }
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (next: Language) => {
      setLangState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      // Remember it for notifications, e-mail and SMS too.
      if (user) profileApi.update({ preferredLanguage: next }).catch(() => undefined);
    },
    [user]
  );

  const t = useCallback(
    (key: string, english: string, params?: Record<string, string | number>) => fill(DICTIONARIES[lang][key] ?? english, params),
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
