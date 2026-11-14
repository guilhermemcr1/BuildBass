import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vite-plus/test';

// Diálogos carregados com `lazy()` podem passar de 1 s (padrão) com a suíte inteira em paralelo.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
    cleanup();
});
