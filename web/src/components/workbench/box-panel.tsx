import { Maximize2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BoxFields } from './box-fields';
import { Panel } from './panel';

// A miniatura e o modal carregam o plano de corte e o 3D, fora do pacote inicial.
const BoxThumbnail = lazy(() => import('./box-thumbnail'));
const BoxDialog = lazy(() => import('./box-dialog'));

export function BoxPanel() {
    const { t } = useTranslation('workbench');
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const show = () => {
        setLoaded(true);
        setOpen(true);
    };

    return (
        <Panel
            region="box"
            title={t('regions.box')}
            actions={
                <Button
                    variant="quiet"
                    aria-label={t('boxDialog.openDialog')}
                    onPress={show}
                    className="px-2.5"
                >
                    <Maximize2 aria-hidden="true" className="size-4" />
                </Button>
            }
        >
            <Suspense fallback={<div className="h-28" aria-hidden="true" />}>
                <BoxThumbnail onPress={show} />
            </Suspense>
            <BoxFields />
            {loaded && (
                <Suspense fallback={null}>
                    <BoxDialog open={open} onOpenChange={setOpen} />
                </Suspense>
            )}
        </Panel>
    );
}
