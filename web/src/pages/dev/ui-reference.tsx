import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { Dialog } from '@/components/ui/dialog';
import { Flag } from '@/components/ui/flag';
import { HelpTip } from '@/components/ui/help-tip';
import { InlineTextField } from '@/components/ui/inline-text-field';
import { Menu } from '@/components/ui/menu';
import { ParameterField } from '@/components/ui/parameter-field';
import { SearchSelect } from '@/components/ui/search-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ShowMore } from '@/components/ui/show-more';
import { SliderField } from '@/components/ui/slider-field';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { FieldStatus } from '@/components/ui/status-indicator';
import { Tabs } from '@/components/ui/tabs';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip } from '@/components/ui/tooltip';
import { ValueTile } from '@/components/ui/value-tile';
import { LanguageSwitch } from '@/components/workbench/language-switch';
import { ThemeSwitch } from '@/components/workbench/theme-switch';
import type { SeriesColor } from '@/lib/project/types';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Página de referência do design system. Só existe com o servidor de desenvolvimento:
// main.tsx a carrega sob import.meta.env.DEV. Marcador usado pelo teste de build: buildbass-ui-reference.

// Classes listadas por extenso para o Tailwind gerar todas (nada de nomes montados em runtime).
const TOKENS: { name: string; swatch: string }[] = [
    { name: 'background', swatch: 'bg-background' },
    { name: 'surface', swatch: 'bg-surface' },
    { name: 'raised', swatch: 'bg-raised' },
    { name: 'border', swatch: 'bg-border' },
    { name: 'foreground', swatch: 'bg-foreground' },
    { name: 'muted', swatch: 'bg-muted' },
    { name: 'disabled', swatch: 'bg-disabled' },
    { name: 'accent', swatch: 'bg-accent' },
    { name: 'accent-foreground', swatch: 'bg-accent-foreground' },
    { name: 'accent-soft', swatch: 'bg-accent-soft' },
    { name: 'status-ok', swatch: 'bg-status-ok' },
    { name: 'status-warn', swatch: 'bg-status-warn' },
    { name: 'status-error', swatch: 'bg-status-error' },
    { name: 'warn-bg', swatch: 'bg-warn-bg' },
    { name: 'warn-foreground', swatch: 'bg-warn-foreground' },
    { name: 'series-1', swatch: 'bg-series-1' },
    { name: 'series-2', swatch: 'bg-series-2' },
    { name: 'series-3', swatch: 'bg-series-3' },
    { name: 'series-4', swatch: 'bg-series-4' },
    { name: 'series-5', swatch: 'bg-series-5' },
    { name: 'series-6', swatch: 'bg-series-6' },
];

const FIELD_STATES: { status: FieldStatus; messageKey?: string }[] = [
    { status: 'none' },
    { status: 'ok', messageKey: 'reference.stateOk' },
    { status: 'warn', messageKey: 'reference.stateWarn' },
    { status: 'error', messageKey: 'reference.stateError' },
    { status: 'unchecked', messageKey: 'reference.stateUnchecked' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-section">{title}</h2>
            {children}
        </section>
    );
}

function useTokenValues(): Record<string, string> {
    const theme = usePreferences((state) => state.theme);
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        const read = () => {
            const style = getComputedStyle(document.documentElement);
            setValues(
                Object.fromEntries(
                    TOKENS.map(({ name }) => [
                        name,
                        style.getPropertyValue(`--${name}`).trim(),
                    ]),
                ),
            );
        };
        const frame = requestAnimationFrame(read);

        return () => cancelAnimationFrame(frame);
    }, [theme]);

    return values;
}

export default function UiReference() {
    const { t } = useTranslation(['common', 'workbench']);
    const tokenValues = useTokenValues();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [segment, setSegment] = useState<'a' | 'b' | 'c'>('a');
    const [color, setColor] = useState<SeriesColor>(1);
    const [tab, setTab] = useState<'one' | 'two' | 'three'>('one');
    const [shown, setShown] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [sampleName, setSampleName] = useState('');
    const [fsHz, setFsHz] = useState<number | undefined>(28);
    const [vbM3, setVbM3] = useState<number | undefined>(0.05);
    const [unit, setUnit] = useState<UnitId>('L');
    const option = (n: number) => t('reference.option', { n });

    return (
        <main
            data-page="buildbass-ui-reference"
            className="mx-auto flex max-w-6xl flex-col gap-8 p-6"
        >
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {t('reference.title')}
                    </h1>
                    <p className="text-sm text-muted">
                        {t('reference.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeSwitch />
                    <LanguageSwitch />
                </div>
            </header>

            <Section title={t('reference.tokens')}>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {TOKENS.map(({ name, swatch }) => (
                        <li
                            key={name}
                            className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2"
                        >
                            <span
                                className={`h-9 rounded-md border border-border ${swatch}`}
                            />
                            <span className="text-xs font-semibold">
                                {name}
                            </span>
                            <span className="num text-[11px] text-muted">
                                {tokenValues[name] ?? ''}
                            </span>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title={t('reference.typography')}>
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                    <span className="text-[22px] font-bold tracking-tight">
                        {t('reference.sampleTitle')}
                    </span>
                    <span className="text-[15px] font-semibold">
                        {t('reference.sampleHeading')}
                    </span>
                    <span className="text-sm">{t('reference.sampleBody')}</span>
                    <span className="text-section">
                        {t('reference.sampleSection')}
                    </span>
                    <span className="num text-[22px] font-semibold">
                        31,7 Hz · 0,38 · 85,0 L
                    </span>
                    <span className="text-xs text-muted">
                        {t('reference.sampleNumbers')}
                    </span>
                </div>
            </Section>

            <Section title={t('reference.buttons')}>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary">{t('reference.primary')}</Button>
                    <Button variant="secondary">
                        {t('reference.secondary')}
                    </Button>
                    <Button variant="quiet">{t('reference.quiet')}</Button>
                    <Button disabled>{t('reference.disabled')}</Button>
                </div>
            </Section>

            <Section title={t('reference.fields')}>
                <div className="grid grid-cols-2 items-start gap-2 md:grid-cols-5">
                    {FIELD_STATES.map(({ status, messageKey }) => (
                        <ParameterField
                            key={status}
                            parameter="fs_hz"
                            valueSi={fsHz}
                            onChangeSi={setFsHz}
                            unit="Hz"
                            status={status}
                            statusMessage={
                                messageKey === undefined
                                    ? undefined
                                    : t(messageKey)
                            }
                        />
                    ))}
                </div>
                <div className="max-w-xs">
                    <SliderField
                        parameter="vb_m3"
                        valueSi={vbM3}
                        onChangeSi={setVbM3}
                        unit={unit}
                        onUnitChange={setUnit}
                        minSi={0.001}
                        maxSi={0.3}
                        scale="linear"
                    />
                </div>
            </Section>

            <Section title={t('reference.controls')}>
                <div className="flex flex-wrap items-start gap-4">
                    <SegmentedControl<'a' | 'b' | 'c'>
                        label={t('reference.controls')}
                        selected={segment}
                        onChange={setSegment}
                        options={[
                            { id: 'a', label: option(1) },
                            { id: 'b', label: option(2) },
                            { id: 'c', label: option(3), disabled: true },
                        ]}
                    />
                    <Menu<'a' | 'b' | 'c'>
                        label={t('reference.menu')}
                        trigger={
                            <span className="flex h-[34px] items-center rounded-md border border-border bg-raised px-3 text-sm">
                                {t('reference.menu')}
                            </span>
                        }
                        items={[
                            { id: 'a', label: option(1) },
                            { id: 'b', label: option(2) },
                            { id: 'c', label: option(3), disabled: true },
                        ]}
                        onAction={() => undefined}
                    />
                    <Tooltip content={t('reference.tooltipBody')} delay={0}>
                        <Button>{t('reference.hoverMe')}</Button>
                    </Tooltip>
                    <Button onPress={() => setDialogOpen(true)}>
                        {t('reference.openDialog')}
                    </Button>
                    <ToggleButton
                        pressed={shown}
                        onPressedChange={setShown}
                        aria-label={t('reference.toggle')}
                    >
                        {shown ? (
                            <Eye aria-hidden="true" className="size-4" />
                        ) : (
                            <EyeOff aria-hidden="true" className="size-4" />
                        )}
                    </ToggleButton>
                    {editingName ? (
                        <InlineTextField
                            label={t('reference.inlineName')}
                            value={sampleName}
                            onCommit={(next) => {
                                setSampleName(next);
                                setEditingName(false);
                            }}
                            onCancel={() => setEditingName(false)}
                        />
                    ) : (
                        <Button
                            variant="quiet"
                            onPress={() => setEditingName(true)}
                        >
                            {sampleName === ''
                                ? t('reference.inlineValue')
                                : sampleName}
                        </Button>
                    )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <SearchSelect
                        label={t('reference.search')}
                        placeholder={t('workbench:catalog.placeholder')}
                        items={[1, 2, 3].map((n) => ({
                            id: String(n),
                            label: option(n),
                        }))}
                        onSelect={() => undefined}
                    />
                    <SearchSelect
                        label={t('workbench:catalog.label')}
                        placeholder={t('workbench:catalog.placeholder')}
                        items={[]}
                        onSelect={() => undefined}
                        disabled
                        disabledReason={t('workbench:catalog.offlineReason')}
                    />
                </div>
                <div className="h-28 rounded-lg border border-border bg-surface px-3">
                    <Tabs<'one' | 'two' | 'three'>
                        label={t('workbench:charts.label')}
                        items={[
                            { id: 'one', label: option(1) },
                            { id: 'two', label: option(2) },
                            { id: 'three', label: option(3) },
                        ]}
                        selected={tab}
                        onChange={setTab}
                    >
                        {(id) => (
                            <p className="pt-3 text-sm text-muted">{id}</p>
                        )}
                    </Tabs>
                </div>
            </Section>

            <Section title={t('reference.feedback')}>
                <div className="flex flex-col gap-2">
                    <Banner>{t('reference.bannerInfo')}</Banner>
                    <Banner tone="warn">{t('reference.bannerWarn')}</Banner>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                    <ValueTile
                        label={t('reference.withValue')}
                        valueSi={31.7}
                        unit="Hz"
                    />
                    <ValueTile label={t('reference.empty')} unit="Hz" />
                    <div className="flex flex-col gap-1.5">
                        <StatusIndicator status="ok" />
                        <StatusIndicator status="warn" />
                        <StatusIndicator status="error" />
                        <StatusIndicator status="unchecked" />
                    </div>
                </div>
            </Section>

            <Section title={t('reference.refinement')}>
                <div className="flex flex-wrap items-start gap-6">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted">
                            {t('reference.helpTip')}
                        </span>
                        <HelpTip
                            label={t('reference.helpTip')}
                            content={t('reference.helpTipBody')}
                        >
                            <span className="w-fit cursor-help rounded-sm border border-border bg-raised px-2 py-1 num text-sm">
                                Fs
                            </span>
                        </HelpTip>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted">
                            {t('reference.statusCompact')}
                        </span>
                        <StatusIndicator status="ok" size="compact" />
                        <StatusIndicator status="warn" size="compact" />
                        <StatusIndicator status="error" size="compact" />
                        <StatusIndicator status="unchecked" size="compact" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted">
                            {t('reference.colors')}
                        </span>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted">
                            {t('reference.flags')}
                        </span>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-2">
                                <Flag country="br" />
                                BR
                            </span>
                            <span className="flex items-center gap-2">
                                <Flag country="us" />
                                EN
                            </span>
                        </div>
                    </div>
                </div>
                <ShowMore id="driverAdvanced" filled={1}>
                    <p className="text-sm text-muted">
                        {t('reference.showMoreBody')}
                    </p>
                </ShowMore>
            </Section>

            <Dialog
                title={t('reference.openDialog')}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            >
                <p className="text-sm text-muted">
                    {t('reference.dialogBody')}
                </p>
                <div className="flex justify-end">
                    <Button
                        variant="primary"
                        onPress={() => setDialogOpen(false)}
                    >
                        {t('comingSoon.close')}
                    </Button>
                </div>
            </Dialog>
        </main>
    );
}
