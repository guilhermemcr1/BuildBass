import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type DriverThumbProps = {
    url: string | undefined;
    // Texto alternativo; vazio quando a imagem é decorativa (o nome já está ao lado).
    alt: string;
    className?: string;
};

// Quadro fixo para a imagem do driver: sem URL ou com a imagem que não carregou (offline, arquivo
// ausente), mostra um espaço reservado do mesmo tamanho, sem salto de layout nem erro.
export function DriverThumb({ url, alt, className }: DriverThumbProps) {
    const { t } = useTranslation('workbench');
    const [failedUrl, setFailedUrl] = useState<string>();
    const broken = url === undefined || failedUrl === url;

    return (
        <span
            className={cn(
                'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-background text-muted',
                className,
            )}
        >
            {broken ? (
                <ImageOff
                    aria-label={alt === '' ? undefined : t('gallery.noImage')}
                    aria-hidden={alt === '' ? true : undefined}
                    className="size-4"
                    data-testid="driver-thumb-placeholder"
                />
            ) : (
                <img
                    src={url}
                    alt={alt}
                    loading="lazy"
                    className="size-full object-cover"
                    onError={() => setFailedUrl(url)}
                />
            )}
        </span>
    );
}
