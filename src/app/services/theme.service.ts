import { Injectable } from '@angular/core';

export type AppTheme = 'system' | 'light' | 'dark';
export type ResolvedAppTheme = 'light' | 'dark';

// index.html อ่านค่านี้ก่อน Angular เริ่มทำงาน เพื่อให้หน้าแรกเป็นธีมที่ถูกต้องทันที
const THEME_BOOT_KEY = 'ipsu-theme-boot';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    public preference: AppTheme = 'system';
    public resolvedTheme: ResolvedAppTheme = 'light';

    private readonly darkModeQuery = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    constructor() {
        this.darkModeQuery?.addEventListener?.('change', this.handleSystemThemeChange);
        const saved = this.readBootTheme();
        this.applyTheme(this.isSupportedTheme(saved) ? saved : 'system');
    }

    private readBootTheme(): string | null {
        try {
            return window.localStorage.getItem(THEME_BOOT_KEY);
        } catch {
            return null;
        }
    }

    public isSupportedTheme(value: unknown): value is AppTheme {
        return value === 'system' || value === 'light' || value === 'dark';
    }

    public applyTheme(preference: AppTheme): void {
        this.preference = preference;
        this.resolvedTheme = preference === 'system'
            ? (this.darkModeQuery?.matches ? 'dark' : 'light')
            : preference;

        if (typeof document === 'undefined') return;

        const isDark = this.resolvedTheme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('ion-palette-dark', isDark);
        document.body?.classList.toggle('dark', isDark);
        document.body?.classList.toggle('ion-palette-dark', isDark);
        document.documentElement.style.colorScheme = this.resolvedTheme;

        try {
            window.localStorage.setItem(THEME_BOOT_KEY, preference);
        } catch { }
    }

    private readonly handleSystemThemeChange = (): void => {
        if (this.preference === 'system') {
            this.applyTheme('system');
        }
    };
}
