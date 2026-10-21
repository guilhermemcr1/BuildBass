import { useTranslation } from 'react-i18next';
import { useActiveProject } from '@/hooks/use-active-project';

// De onde veio o driver do projeto (US4). Só informação: o driver já foi copiado e não tem mais
// vínculo com o catálogo. A região viva fica sempre no DOM para anunciar a cópia.
export function DriverOrigin() {
    const { t } = useTranslation('workbench');
    const source = useActiveProject((state) => state.data.driverSource);

    return (
        <p aria-live="polite" className="text-xs text-muted empty:hidden">
            {source !== undefined && (
                <>
                    <span className="font-semibold">
                        {t('catalog.originLabel')}:
                    </span>{' '}
                    {source.brand} {source.model}
                    {source.variant !== undefined && ` (${source.variant})`}
                </>
            )}
        </p>
    );
}
