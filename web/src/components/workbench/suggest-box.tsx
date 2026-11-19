import { Bot } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { deriveDriver, twoChambers } from '@/engine';
import type { DriverKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { PARAMETERS } from '@/lib/parameters';
import { AiSuggestDialog } from './ai-suggest-dialog';

const NEEDS: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];

type SuggestBoxProps = {
    title: string;
    // Os campos do grupo (volume, sintonia, perdas); a sugestão preenche alguns deles.
    children: ReactNode;
};

// Grupo "Volume e sintonia": título com o botão que pede sugestões à IA (conferidas no motor), os
// campos logo abaixo e o motivo ou resultado depois deles.
export function SuggestBox({ title, children }: SuggestBoxProps) {
    const { t } = useTranslation(['workbench', 'engine']);
    const { locale } = useLocale();
    const data = useActiveProject((state) => state.data);
    const [message, setMessage] = useState<string | null>(null);
    const [aiOpen, setAiOpen] = useState(false);
    const reasonId = useId();
    const { values } = deriveDriver(data.driver);
    const missing = NEEDS.filter((key) => values[key].value === undefined);
    const listFormat = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });
    const missingReason =
        missing.length === 0
            ? undefined
            : t('suggest.needs', {
                  missing: listFormat.format(
                      missing.map((key) => PARAMETERS[key].symbol),
                  ),
              });
    // Não há alinhamento clássico de bandpass nesta versão.
    const reason = twoChambers(data.box.type)
        ? t('suggest.bandpassUnavailable')
        : missingReason;

    return (
        <section aria-label={title} className="flex flex-col gap-2.5">
            <header className="flex min-h-8 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <h3 className="text-section whitespace-nowrap">{title}</h3>
                <div className="flex flex-wrap items-center gap-1">
                    {/* A IA só cobre selada e dutada, com os mesmos dados mínimos da clássica. */}
                    <Button
                        variant="quiet"
                        onPress={() => setAiOpen(true)}
                        disabled={reason !== undefined}
                        aria-describedby={
                            reason === undefined ? undefined : reasonId
                        }
                    >
                        <Bot aria-hidden="true" className="size-4" />
                        {t('ai.button')}
                    </Button>
                </div>
            </header>
            <AiSuggestDialog
                open={aiOpen}
                onOpenChange={setAiOpen}
                onApplied={setMessage}
            />
            {children}
            {reason !== undefined && (
                <p id={reasonId} className="text-[11px] text-muted">
                    {reason}
                </p>
            )}
            {message !== null && <Banner>{message}</Banner>}
        </section>
    );
}
