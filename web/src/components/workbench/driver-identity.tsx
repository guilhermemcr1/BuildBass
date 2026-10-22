import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from '@/components/ui/text-field';
import { useActiveProject } from '@/hooks/use-active-project';
import { identityOf } from '@/lib/saved-drivers/types';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { DriverTypeSelect } from './driver-type-select';

// Quem é o driver do projeto: marca, modelo, variação e tipo (contracts/ui.md). Preenchido ao
// copiar do catálogo ou de "Meus alto-falantes" e editável à mão, para o driver que não está em
// nenhum dos dois. É só informação: não muda os cálculos, e o que se escreve aqui vai junto no
// "Salvar alto-falante" e no "Enviar driver".
export function DriverIdentity() {
    const { t } = useTranslation('workbench');
    const source = useActiveProject((state) => state.data.driverSource);
    const setIdentity = useActiveProject((state) => state.setDriverIdentity);
    const [editing, setEditing] = useState(false);
    const fromMine = useSavedDrivers(
        (state) =>
            source?.brand !== undefined &&
            source.model !== undefined &&
            state.items.some(
                (item) =>
                    identityOf(item) ===
                    identityOf({
                        brand: source.brand ?? '',
                        model: source.model ?? '',
                        variant: source.variant,
                    }),
            ),
    );
    const name = [source?.brand, source?.model, source?.variant]
        .filter((part) => part !== undefined && part !== '')
        .join(' ');

    return (
        <fieldset
            className="flex flex-col gap-2"
            // Escrever aqui não é "aplicar um driver": o aviso para leitor de tela só vale quando a
            // mudança veio de fora (buscador, Meus alto-falantes), com o foco fora do bloco.
            onFocus={() => setEditing(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setEditing(false);
                }
            }}
        >
            <legend className="mb-1.5 text-xs font-semibold text-muted">
                {t('identity.title')}
            </legend>
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
                <TextInput
                    label={t('identity.brand')}
                    value={source?.brand ?? ''}
                    onChange={(brand) => setIdentity({ brand })}
                    maxLength={80}
                    placeholder={t('identity.brandPlaceholder')}
                />
                <TextInput
                    label={t('identity.model')}
                    value={source?.model ?? ''}
                    onChange={(model) => setIdentity({ model })}
                    maxLength={80}
                    placeholder={t('identity.modelPlaceholder')}
                />
                <TextInput
                    label={t('identity.variant')}
                    value={source?.variant ?? ''}
                    onChange={(variant) => setIdentity({ variant })}
                    maxLength={40}
                    placeholder={t('identity.variantPlaceholder')}
                />
                <DriverTypeSelect
                    value={source?.type}
                    onChange={(type) => setIdentity({ type })}
                />
            </div>
            {fromMine && (
                <p className="text-[11px] text-muted">
                    {t('identity.fromMine')}
                </p>
            )}
            <p aria-live="polite" className="sr-only">
                {!editing && name !== '' ? t('identity.applied', { name }) : ''}
            </p>
        </fieldset>
    );
}
