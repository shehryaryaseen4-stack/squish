import { en, StringKey } from './en';

const languages: Record<string, Partial<Record<StringKey, string>>> = { en };
let current = 'en';

export const availableLanguages = [{ id: 'en', name: 'English' }];

export function setLanguage(id: string) {
  current = languages[id] ? id : 'en';
  document.documentElement.lang = current;
}

/** Translate a UI string, filling {placeholders}. */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  const s = languages[current]?.[key] ?? en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
