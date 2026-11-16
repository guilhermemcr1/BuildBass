import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://127.0.0.1:8010';
const PREVIEW_URL = 'http://127.0.0.1:4173';
const DEV_URL = 'http://127.0.0.1:5173';

// Os cenários antigos preenchem Qes, Qms, Re etc., que o modo Normal esconde atrás de "Mostrar
// mais". Eles rodam em Pro por padrão; os cenários do Normal limpam isso com
// `test.use({ storageState: NORMAL_MODE })`.
function proMode(origin: string) {
    return {
        cookies: [],
        origins: [
            {
                origin,
                localStorage: [
                    {
                        name: 'buildbass.preferences',
                        value: JSON.stringify({
                            state: { mode: 'pro' },
                            version: 2,
                        }),
                    },
                ],
            },
        ],
    };
}

export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: PREVIEW_URL,
        locale: 'pt-BR',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: proMode(PREVIEW_URL),
            },
            testIgnore: 'a11y.spec.ts',
        },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                storageState: proMode(PREVIEW_URL),
            },
            testIgnore: 'a11y.spec.ts',
        },
        // A página de referência (/dev/ui) só existe no servidor de desenvolvimento.
        {
            name: 'dev',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: DEV_URL,
                storageState: proMode(DEV_URL),
            },
            testMatch: 'a11y.spec.ts',
        },
    ],
    webServer: [
        {
            command: 'php artisan serve --host=127.0.0.1 --port=8010',
            cwd: '../api',
            url: `${API_URL}/up`,
            reuseExistingServer: true,
            env: { FRONTEND_URL: `${PREVIEW_URL},${DEV_URL}` },
        },
        {
            command: 'npm run build && npm run preview -- --host 127.0.0.1',
            url: PREVIEW_URL,
            reuseExistingServer: true,
            timeout: 180_000,
            env: { VITE_API_URL: API_URL },
        },
        {
            command: 'npm run dev -- --host 127.0.0.1',
            url: DEV_URL,
            reuseExistingServer: true,
            env: { VITE_API_URL: API_URL },
        },
    ],
});
