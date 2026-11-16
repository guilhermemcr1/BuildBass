import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { DriverImageRef } from '@/lib/catalog/types';
import { DriverThumb } from './driver-thumb';

type DriverGalleryProps = {
    // Marca e modelo do driver, para o texto alternativo.
    name: string;
    images: DriverImageRef[];
};

// Galeria do driver copiado do catálogo: tira de miniaturas e ampliação num diálogo, com setas e
// Esc pelo teclado. Sem imagens não renderiza nada.
export function DriverGallery({ name, images }: DriverGalleryProps) {
    const { t } = useTranslation('workbench');
    const [current, setCurrent] = useState<number>();
    const [failed, setFailed] = useState<string>();
    const count = images.length;
    const open = current !== undefined;

    // Setas navegam enquanto a ampliação está aberta (o foco fica no diálogo, não no conteúdo).
    useEffect(() => {
        if (!open || count === 0) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            const step =
                event.key === 'ArrowLeft'
                    ? -1
                    : event.key === 'ArrowRight'
                      ? 1
                      : 0;

            if (step !== 0) {
                setCurrent((index) =>
                    index === undefined
                        ? index
                        : (index + step + count) % count,
                );
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, count]);

    if (images.length === 0) {
        return null;
    }

    const altOf = (index: number) =>
        t('gallery.alt', { name, current: index + 1, total: images.length });
    const move = (step: number) =>
        setCurrent((index) =>
            index === undefined
                ? index
                : (index + step + images.length) % images.length,
        );
    const image = current === undefined ? undefined : images[current];

    return (
        <section
            aria-label={t('gallery.title')}
            className="flex flex-col gap-1.5"
        >
            <h3 className="text-xs font-semibold text-muted">
                {t('gallery.title')}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
                {images.map((item, index) => (
                    <li key={item.url}>
                        <Button
                            variant="quiet"
                            aria-label={t('gallery.open', {
                                current: index + 1,
                                total: images.length,
                            })}
                            onPress={() => setCurrent(index)}
                            className="h-14 w-14 p-0"
                        >
                            <DriverThumb
                                url={item.thumb_url}
                                alt={altOf(index)}
                                className="size-14"
                            />
                        </Button>
                    </li>
                ))}
            </ul>
            <Dialog
                title={t('gallery.title')}
                open={open}
                onOpenChange={(next) => {
                    if (!next) {
                        setCurrent(undefined);
                    }
                }}
                size="lg"
            >
                {image !== undefined && current !== undefined && (
                    <div className="flex flex-col gap-3">
                        <div className="flex min-h-48 items-center justify-center">
                            {failed === image.url ? (
                                <DriverThumb
                                    url={undefined}
                                    alt={altOf(current)}
                                    className="size-32"
                                />
                            ) : (
                                <img
                                    src={image.url}
                                    alt={altOf(current)}
                                    className="max-h-[60dvh] max-w-full rounded object-contain"
                                    onError={() => setFailed(image.url)}
                                />
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <Button
                                variant="secondary"
                                aria-label={t('gallery.previous')}
                                disabled={images.length < 2}
                                onPress={() => move(-1)}
                            >
                                <ChevronLeft aria-hidden className="size-4" />
                            </Button>
                            <span
                                className="text-xs text-muted tabular-nums"
                                aria-live="polite"
                            >
                                {t('gallery.counter', {
                                    current: current + 1,
                                    total: images.length,
                                })}
                            </span>
                            <Button
                                variant="secondary"
                                aria-label={t('gallery.next')}
                                disabled={images.length < 2}
                                onPress={() => move(1)}
                            >
                                <ChevronRight aria-hidden className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>
        </section>
    );
}
