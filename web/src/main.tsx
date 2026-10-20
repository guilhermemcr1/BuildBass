import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Workbench from '@/pages/workbench';
import '@/styles/app.css';

const root = document.getElementById('root');

if (root === null) {
    throw new Error('Elemento #root não encontrado em index.html');
}

createRoot(root).render(
    <StrictMode>
        <Workbench />
    </StrictMode>,
);
