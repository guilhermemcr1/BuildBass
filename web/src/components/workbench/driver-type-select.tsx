import { useTranslation } from 'react-i18next';
import { SelectField } from '@/components/ui/select-field';
import { DRIVER_TYPES } from '@/lib/project/types';
import type { DriverType } from '@/lib/project/types';

const NONE = 'none';

type DriverTypeSelectProps = {
    value: DriverType | undefined;
    onChange: (type: DriverType | undefined) => void;
    disabled?: boolean;
    className?: string;
};

// Tipo do alto-falante (subwoofer, woofer…); "Não informado" limpa a escolha.
export function DriverTypeSelect({
    value,
    onChange,
    disabled,
    className,
}: DriverTypeSelectProps) {
    const { t } = useTranslation('workbench');

    return (
        <SelectField<DriverType | typeof NONE>
            label={t('identity.type')}
            selected={value ?? NONE}
            onChange={(id) => onChange(id === NONE ? undefined : id)}
            options={[
                { id: NONE, label: t('identity.typeNone') },
                ...DRIVER_TYPES.map((id) => ({
                    id,
                    label: t(`driverType.${id}`),
                })),
            ]}
            disabled={disabled}
            className={className}
        />
    );
}
