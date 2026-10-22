import { Download, Pencil, Play, Search, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import {
    FileTrigger,
    Input,
    TextField,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useActiveProject } from '@/hooks/use-active-project';
import {
    downloadSavedDrivers,
    parseSavedDriversFile,
} from '@/lib/saved-drivers/file';
import type { DriversFileErrorCode } from '@/lib/saved-drivers/file';
import { SAVED_DRIVERS_MAX, identityOf } from '@/lib/saved-drivers/types';
import type { SavedDriver, SavedDriverDraft } from '@/lib/saved-drivers/types';
import { formatQuantity } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { storageProbe } from '@/stores/workspace';
import SaveDriverDialog from './save-driver-dialog';

type SavedDriversDialogProps = {
    onClose: () => void;
};

type Pending = { drafts: SavedDriverDraft[]; duplicates: number };
type Notice =
    | { kind: 'error'; code: DriversFileErrorCode; path?: string }
    | { kind: 'tooMany'; total: number }
    | { kind: 'done'; added: number; replaced: number; ignored: number };

function nameOf(driver: Pick<SavedDriverDraft, 'brand' | 'model' | 'variant'>) {
    const name = `${driver.brand} ${driver.model}`;

    return driver.variant === undefined ? name : `${name} (${driver.variant})`;
}

function matches(driver: SavedDriver, term: string): boolean {
    return nameOf(driver).toLowerCase().includes(term.trim().toLowerCase());
}

// Gerenciar a lista pessoal: pesquisar, usar no projeto, editar, excluir (com confirmação),
// exportar e importar (specs/008, FR-024, FR-025, FR-027a).
export default function SavedDriversDialog({
    onClose,
}: SavedDriversDialogProps) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const lengthUnit = defaultUnitFor('length', unitSystem);
    const items = useSavedDrivers((state) => state.items);
    const remove = useSavedDrivers((state) => state.remove);
    const importMany = useSavedDrivers((state) => state.importMany);
    const applySaved = useActiveProject((state) => state.applySavedDriver);
    const [term, setTerm] = useState('');
    const [editing, setEditing] = useState<SavedDriver | undefined>(undefined);
    const [deleting, setDeleting] = useState<SavedDriver | undefined>(
        undefined,
    );
    const [pending, setPending] = useState<Pending | undefined>(undefined);
    const [notice, setNotice] = useState<Notice | undefined>(undefined);
    const [storageOk] = useState(() => storageProbe());
    const shown =
        term.trim() === ''
            ? items
            : items.filter((item) => matches(item, term));

    const sizes = (item: SavedDriver): string =>
        [
            item.nominal_diameter_m !== undefined &&
                t('saved.list.sizeDiameter', {
                    value: formatQuantity(
                        item.nominal_diameter_m,
                        lengthUnit,
                        locale,
                    ),
                }),
            item.cutout_m !== undefined &&
                t('saved.list.sizeCutout', {
                    value: formatQuantity(item.cutout_m, lengthUnit, locale),
                }),
            item.depth_m !== undefined &&
                t('saved.list.sizeDepth', {
                    value: formatQuantity(item.depth_m, lengthUnit, locale),
                }),
        ]
            .filter((part): part is string => part !== false)
            .join(' · ');

    const openFile = async (files: FileList | null) => {
        const file = files?.[0];

        if (file === undefined) {
            return;
        }

        const result = await parseSavedDriversFile(file);

        if (!result.ok) {
            setPending(undefined);
            setNotice({ kind: 'error', code: result.code, path: result.path });

            return;
        }

        const known = new Set(items.map((item) => identityOf(item)));
        const duplicates = result.drivers.filter((driver) =>
            known.has(identityOf(driver)),
        ).length;

        if (duplicates > 0) {
            setNotice(undefined);
            setPending({ drafts: result.drivers, duplicates });

            return;
        }

        finishImport(result.drivers, 'keep');
    };

    const finishImport = (
        drafts: SavedDriverDraft[],
        onDuplicate: 'replace' | 'keep',
    ) => {
        const result = importMany(drafts, onDuplicate);

        setPending(undefined);
        setNotice(
            result.status === 'ok'
                ? {
                      kind: 'done',
                      added: result.added,
                      replaced: result.replaced,
                      ignored: result.ignored,
                  }
                : { kind: 'tooMany', total: result.total },
        );
    };

    if (editing !== undefined) {
        return (
            <SaveDriverDialog
                initial={editing}
                editing={editing}
                onClose={() => setEditing(undefined)}
            />
        );
    }

    return (
        <Dialog
            title={t('saved.manageTitle')}
            open
            size="lg"
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            {!storageOk && <Banner tone="warn">{t('saved.storageOff')}</Banner>}
            <TextField
                aria-label={t('saved.list.search')}
                value={term}
                onChange={setTerm}
                className="flex h-[34px] items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:border-accent"
            >
                <Search
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted"
                />
                <Input
                    type="search"
                    placeholder={t('saved.list.search')}
                    className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
                />
            </TextField>
            {shown.length === 0 ? (
                <p className="py-3 text-sm text-muted">
                    {items.length === 0
                        ? t('saved.list.empty')
                        : t('saved.list.noMatch', { term: term.trim() })}
                </p>
            ) : (
                <ul
                    aria-label={t('saved.manageTitle')}
                    className="flex max-h-80 flex-col overflow-y-auto rounded-md border border-border"
                >
                    {shown.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0"
                        >
                            <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold">
                                    {nameOf(item)}
                                </span>
                                <span className="block truncate text-[11px] text-muted tabular-nums">
                                    {sizes(item)}
                                </span>
                            </div>
                            <div className="flex shrink-0 items-center">
                                <Button
                                    variant="quiet"
                                    className="px-2.5"
                                    aria-label={t('saved.list.use', {
                                        name: nameOf(item),
                                    })}
                                    onPress={() => {
                                        applySaved(item);
                                        onClose();
                                    }}
                                >
                                    <Play
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </Button>
                                <Button
                                    variant="quiet"
                                    className="px-2.5"
                                    aria-label={t('saved.list.edit', {
                                        name: nameOf(item),
                                    })}
                                    onPress={() => setEditing(item)}
                                >
                                    <Pencil
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </Button>
                                <Button
                                    variant="quiet"
                                    className="px-2.5"
                                    aria-label={t('saved.list.delete', {
                                        name: nameOf(item),
                                    })}
                                    onPress={() => setDeleting(item)}
                                >
                                    <Trash2
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {deleting !== undefined && (
                <div
                    role="alertdialog"
                    aria-labelledby="delete-saved-title"
                    className="flex flex-col gap-2 rounded-md border border-status-warn p-3"
                >
                    <p
                        id="delete-saved-title"
                        className="text-sm font-semibold"
                    >
                        {t('saved.deleteConfirm.title')}
                    </p>
                    <p className="text-sm text-muted">
                        {t('saved.deleteConfirm.body', {
                            name: nameOf(deleting),
                        })}
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="quiet"
                            onPress={() => setDeleting(undefined)}
                        >
                            {t('saved.deleteConfirm.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            autoFocus
                            onPress={() => {
                                remove(deleting.id);
                                setDeleting(undefined);
                            }}
                        >
                            {t('saved.deleteConfirm.confirm')}
                        </Button>
                    </div>
                </div>
            )}
            {pending !== undefined && (
                <div
                    role="alertdialog"
                    aria-labelledby="import-duplicates"
                    className="flex flex-col gap-2 rounded-md border border-status-warn p-3"
                >
                    <p id="import-duplicates" className="text-sm">
                        {t('saved.file.duplicates', {
                            count: pending.duplicates,
                        })}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            variant="quiet"
                            onPress={() => setPending(undefined)}
                        >
                            {t('saved.actions.cancel')}
                        </Button>
                        <Button
                            onPress={() => finishImport(pending.drafts, 'keep')}
                        >
                            {t('saved.file.keep')}
                        </Button>
                        <Button
                            variant="primary"
                            autoFocus
                            onPress={() =>
                                finishImport(pending.drafts, 'replace')
                            }
                        >
                            {t('saved.file.replace')}
                        </Button>
                    </div>
                </div>
            )}
            <div role="status" aria-live="polite" className="empty:hidden">
                {notice !== undefined && (
                    <p
                        className={
                            notice.kind === 'done'
                                ? 'text-sm text-muted'
                                : 'text-sm text-status-error'
                        }
                    >
                        {notice.kind === 'done' &&
                            t('saved.file.result', {
                                added: notice.added,
                                replaced: notice.replaced,
                                ignored: notice.ignored,
                            })}
                        {notice.kind === 'tooMany' &&
                            t('saved.file.tooManyTotal', {
                                total: notice.total,
                                max: SAVED_DRIVERS_MAX,
                            })}
                        {notice.kind === 'error' &&
                            t(`saved.file.errors.${notice.code}`, {
                                path: notice.path ?? '',
                                max: SAVED_DRIVERS_MAX,
                            })}
                    </p>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        disabled={items.length === 0}
                        onPress={() => downloadSavedDrivers(items)}
                    >
                        <Download aria-hidden="true" className="size-4" />
                        {t('saved.file.export')}
                    </Button>
                    <FileTrigger
                        acceptedFileTypes={['.json', 'application/json']}
                        onSelect={(files) => void openFile(files)}
                    >
                        <Button variant="secondary">
                            <Upload aria-hidden="true" className="size-4" />
                            {t('saved.file.import')}
                        </Button>
                    </FileTrigger>
                </div>
                <Button variant="primary" onPress={onClose}>
                    {t('saved.actions.close')}
                </Button>
            </div>
        </Dialog>
    );
}
