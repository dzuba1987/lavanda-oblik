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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
