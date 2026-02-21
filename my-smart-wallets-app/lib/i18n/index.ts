import { en, type UiDictionary } from "./en";

export type UiLocale = "en";

const DICTIONARIES: Record<UiLocale, UiDictionary> = {
  en,
};

export const getDictionary = (locale: UiLocale = "en"): UiDictionary => {
  return DICTIONARIES[locale];
};

export const uiText = getDictionary("en");

