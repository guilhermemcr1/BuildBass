import { AlertTriangle, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Dialog as AriaDialog,
    Heading,
    Modal,
    ModalOverlay,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    children: ReactNode;
    // Botões, do menos para o mais importante (o último fica à direita).
    actions: ReactNode;
    onCancel: () => void;
    // `danger` para apagar ou descartar: ícone de lixeira e destaque de alerta.
    tone?: 'warn' | 'danger';
    icon?: LucideIcon;
    // Mais largo quando há três ações, para caberem numa linha só.
    wide?: boolean;
};

// Confirmação curta, sempre por cima de tudo (inclusive de outro diálogo): ícone, título, texto e
// botões. Esc e clicar fora cancelam. Um só padrão para toda confirmação do site.
export function ConfirmDialog({
    open,
    title,
    children,
    actions,
    onCancel,
    tone = 'warn',
    icon,
    wide = false,
}: ConfirmDialogProps) {
    const Icon = icon ?? (tone === 'danger' ? Trash2 : AlertTriangle);

    return (
        <ModalOverlay
            isOpen={open}
            onOpenChange={(next) => {
                if (!next) {
                    onCancel();
                }
            }}
            isDismissable
            className="overlay-motion fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
        >
            <Modal
                className={cn(
                    'modal-motion w-full rounded-xl border border-border bg-surface text-foreground shadow-2xl',
                    wide ? 'max-w-md' : 'max-w-sm',
                )}
            >
                <AriaDialog
                    role="alertdialog"
                    className="flex flex-col gap-4 p-5 outline-none"
                >
                    <div className="flex items-start gap-3">
                        <span
                            aria-hidden="true"
                            className={cn(
                                'grid size-10 shrink-0 place-items-center rounded-full',
                                tone === 'danger'
                                    ? 'bg-status-error/12 text-status-error'
                                    : 'bg-status-warn/15 text-status-warn',
                            )}
                        >
                            <Icon className="size-5" />
                        </span>
                        <div className="flex min-w-0 flex-col gap-1 pt-0.5">
                            <Heading
                                slot="title"
                                className="text-base font-semibold"
                            >
                                {title}
                            </Heading>
                            <div className="text-sm leading-relaxed text-muted">
                                {children}
                            </div>
                        </div>
                    </div>
                    {/* No celular, um botão por linha com o principal em cima; do `sm` em diante,
                        lado a lado à direita (o primeiro pode ir à esquerda com `sm:mr-auto`). */}
                    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
                        {actions}
                    </div>
                </AriaDialog>
            </Modal>
        </ModalOverlay>
    );
}
