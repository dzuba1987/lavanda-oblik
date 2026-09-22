"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Вмикає темну тему.
 *
 * У проєкті вже було 232 класи `dark:` у 30 файлах і повний блок токенів
 * `.dark` у globals.css, але клас `.dark` не ставився ніколи — цієї обгортки
 * просто не існувало. Тобто вся темна розмітка була мертвим кодом.
 *
 * `attribute="class"` — бо `@custom-variant dark (&:is(.dark *))` у
 * globals.css чекає саме клас, а не data-атрибут.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Світла за замовчуванням, а не системна: застосунок відкривають із
      // телефонів, де нічна тема часто стоїть за розкладом, і облік раптово
      // ставав темним посеред дня. «Як у системі» лишається окремим вибором
      // у меню профілю — enableSystem для цього й потрібен.
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
