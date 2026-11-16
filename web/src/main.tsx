import { StrictMode, Suspense, lazy } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app';
import { initI18n } from '@/i18n';
import Workbench from '@/pages/workbench';
import { usePreferences } from '@/stores/preferences';
import '@/styles/app.css';

initI18n(usePreferences.getState().locale);

// A referência de componentes só existe no servidor de desenvolvimento: no build de produção
// este ramo é eliminado e o código da página não entra no pacote.
function resolvePage(): ComponentType {
    if (import.meta.env.DEV && window.location.pathname === '/dev/ui') {
        return lazy(() => import('@/pages/dev/ui-reference'));
    }

    return Workbench;
}

const Page = resolvePage();
const root = document.getElementById('root');

if (root === null) {
    throw new Error('Elemento #root não encontrado em index.html');
}

createRoot(root).render(
    <StrictMode>
        <App>
            <Suspense>
                <Page />
            </Suspense>
        </App>
    </StrictMode>,
);
