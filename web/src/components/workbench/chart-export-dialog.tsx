import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
    availableGroups,
    buildScene,
    effectiveGroups,
    exportChart,
    sceneToSvg,
} from '@/lib/chart-export';
import { downloadBlob } from '@/lib/chart-export/download';
import { LEGEND_GROUPS } from '@/lib/chart-export/types';
import type { ExportFormat, ExportInput } from '@/lib/chart-export/types';
import { useChartExport } from '@/stores/chart-export';

type ChartExportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Gráfico da aba aberta no instante em que o diálogo abriu (zoom e faixa incluídos).
    input: ExportInput;
};

// Exportar o gráfico aberto como PNG ou PDF, com a legenda que a pessoa escolher (specs/011). A
// prévia é o mesmo SVG de onde saem os dois arquivos.
export default function ChartExportDialog({
    open,
    onOpenChange,
    input,
}: ChartExportDialogProps) {
    const { t } = useTranslation('workbench');
    const format = useChartExport((state) => state.format);
    const groups = useChartExport((state) => state.groups);
    const setFormat = useChartExport((state) => state.setFormat);
    const setGroup = useChartExport((state) => state.setGroup);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    const available = availableGroups(input.kind, input.limits);
    const effective = effectiveGroups(groups, input.kind, input.limits);
    const svg = sceneToSvg(buildScene(input, effective));
    const previewUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    const download = async () => {
        setLoading(true);
        setFailed(false);

        try {
            const { blob, fileName } = await exportChart(input, {
                format,
                groups: effective,
            });

            downloadBlob(blob, fileName);
            onOpenChange(false);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            title={t('charts.export.title')}
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                    <SegmentedControl<ExportFormat>
                        label={t('charts.export.format')}
                        selected={format}
                        onChange={setFormat}
                        options={[
                            { id: 'png', label: t('charts.export.formatPng') },
                            { id: 'pdf', label: t('charts.export.formatPdf') },
                        ]}
                    />
                    <fieldset className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                        <legend className="mb-1 text-xs font-semibold text-muted uppercase">
                            {t('charts.export.legend')}
                        </legend>
                        {LEGEND_GROUPS.map((group) => {
                            const state = available[group];

                            return (
                                <div key={group}>
                                    <Checkbox
                                        selected={
                                            state.available && groups[group]
                                        }
                                        onChange={(selected) =>
                                            setGroup(group, selected)
                                        }
                                        disabled={!state.available}
                                    >
                                        {t(`charts.export.groups.${group}`)}
                                    </Checkbox>
                                    {!state.available && (
                                        <p className="pl-6 text-xs text-muted">
                                            {t(state.reasonKey)}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </fieldset>
                </div>
                <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-muted uppercase">
                        {t('charts.export.preview')}
                    </p>
                    <img
                        src={previewUrl}
                        alt={t('charts.export.previewAlt', {
                            title: input.title,
                            projects: input.projects
                                .map((project) => project.name)
                                .join(', '),
                        })}
                        className="w-full rounded-md border border-border bg-white"
                    />
                </div>
            </div>
            {failed && (
                <div role="alert">
                    <Banner tone="warn" icon={AlertTriangle}>
                        {t('charts.export.error')}
                    </Banner>
                </div>
            )}
            <div className="flex justify-end">
                <Button variant="primary" disabled={loading} onPress={download}>
                    {loading
                        ? t('charts.export.downloading')
                        : t('charts.export.download')}
                </Button>
            </div>
        </Dialog>
    );
}
