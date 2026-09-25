import { Sun, Moon } from "lucide-react";
import { useThemeContext } from "@/shared/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeContext();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 min-h-[44px] min-w-[44px] rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]"
      aria-label={
        isDark ? "Alternar para modo claro" : "Alternar para modo escuro"
      }
      title={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
    >
      <div className="relative w-5 h-5">
        {/* Sun */}
        <Sun
          className="absolute inset-0 w-5 h-5 transition-all duration-300"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark
              ? "rotate(90deg) scale(0.6)"
              : "rotate(0deg) scale(1)",
          }}
          strokeWidth={2}
        />
        {/* Moon */}
        <Moon
          className="absolute inset-0 w-5 h-5 transition-all duration-300"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark
              ? "rotate(0deg) scale(1)"
              : "rotate(-90deg) scale(0.6)",
          }}
          strokeWidth={2}
        />
      </div>
    </button>
  );
}
