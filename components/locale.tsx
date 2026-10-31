"use client";
import { createContext, useContext, useMemo } from "react";
import { translate } from "../lib/i18n";
const LocaleContext = createContext({ hindi: false, t: (value: string | null | undefined, alternate?: string) => translate(value, false, alternate) });
export function LocaleProvider({ hindi, children }: { hindi: boolean; children: React.ReactNode }) {
    const value = useMemo(() => ({ hindi, t: (text: string | null | undefined, alternate?: string) => translate(text, hindi, alternate) }), [hindi]);
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
