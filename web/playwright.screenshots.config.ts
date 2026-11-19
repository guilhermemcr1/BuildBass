import { defineConfig, devices } from '@playwright/test';

// Gera as imagens do README (`.github/assets/`) a partir do app real, com a API simulada pelo
// contrato (tests/e2e/catalog-mock.ts): não precisa de banco nem de chave de IA.
// Uso: `npm run screenshots` (constrói e sobe o preview sozinho).
const PREVIEW_URL = 'http://127.0.0.1:4173';

export default defineConfig({
    testDir: 'tests/screenshots',
    fullyParallel: true,
    reporter: 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: PREVIEW_URL,
        locale: 'pt-BR',
        deviceScaleFactor: 1,
    },
    projects: [{ name: 'screenshots' }],
    webServer: {
        command: 'npm run build && npm run preview -- --host 127.0.0.1',
        url: PREVIEW_URL,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { VITE_API_URL: 'http://127.0.0.1:8010' },
    },
});
