import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        locale: 'pt-BR',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: [
        {
            command: 'php artisan serve --host=127.0.0.1 --port=8010',
            cwd: '../api',
            url: 'http://127.0.0.1:8010/up',
            reuseExistingServer: true,
            env: { FRONTEND_URL: 'http://127.0.0.1:4173' },
        },
        {
            command: 'npm run build && npm run preview -- --host 127.0.0.1',
            url: 'http://127.0.0.1:4173',
            reuseExistingServer: true,
            timeout: 180_000,
            env: { VITE_API_URL: 'http://127.0.0.1:8010' },
        },
    ],
});
