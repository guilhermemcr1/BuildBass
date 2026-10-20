import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type FileDropProps = {
    onFile: (file: File) => void;
};

function carriesFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes('Files') ?? false;
}

// Soltar um arquivo em qualquer ponto da bancada abre o projeto. É um atalho para o mouse; pelo
// teclado o caminho é o botão Abrir.
export function FileDrop({ onFile }: FileDropProps) {
    const { t } = useTranslation('project');
    const [active, setActive] = useState(false);
    const handler = useRef(onFile);

    useEffect(() => {
        handler.current = onFile;
    });

    useEffect(() => {
        // dragenter/dragleave disparam em cada filho: conta entradas para saber quando saiu.
        let depth = 0;

        const enter = (event: DragEvent) => {
            if (carriesFiles(event)) {
                depth += 1;
                setActive(true);
            }
        };
        const leave = (event: DragEvent) => {
            if (carriesFiles(event)) {
                depth = Math.max(0, depth - 1);
                setActive(depth > 0);
            }
        };
        const over = (event: DragEvent) => {
            if (carriesFiles(event)) {
                event.preventDefault();
            }
        };
        const drop = (event: DragEvent) => {
            if (!carriesFiles(event)) {
                return;
            }

            event.preventDefault();
            depth = 0;
            setActive(false);
            const file = event.dataTransfer?.files[0];

            if (file !== undefined) {
                handler.current(file);
            }
        };

        window.addEventListener('dragenter', enter);
        window.addEventListener('dragleave', leave);
        window.addEventListener('dragover', over);
        window.addEventListener('drop', drop);

        return () => {
            window.removeEventListener('dragenter', enter);
            window.removeEventListener('dragleave', leave);
            window.removeEventListener('dragover', over);
            window.removeEventListener('drop', drop);
        };
    }, []);

    if (!active) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-2 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-background/80">
            <p className="text-lg font-semibold">{t('file.dropHere')}</p>
        </div>
    );
}
