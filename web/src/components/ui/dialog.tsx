import type { ReactNode } from 'react';
import {
    Dialog as AriaDialog,
    Heading,
    Modal,
    ModalOverlay,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

type DialogProps = {
    title: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
    // `lg` para formulários longos: o conteúdo rola dentro do diálogo. `xl` é largo (campos ao lado
    // de uma vista) e ocupa a tela toda abaixo de 768 px.
    size?: 'md' | 'lg' | 'xl';
};

export function Dialog({
    title,
    open,
    onOpenChange,
    children,
    size = 'md',
}: DialogProps) {
    return (
        <ModalOverlay
            isOpen={open}
            onOpenChange={onOpenChange}
            isDismissable
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
            <Modal
                className={cn(
                    'w-full rounded-lg border border-border bg-surface text-foreground shadow-xl',
                    size === 'md' && 'max-w-md',
                    size === 'lg' &&
                        'max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto',
                    size === 'xl' &&
                        'max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto max-md:h-[calc(100dvh-2rem)]',
                )}
            >
                <AriaDialog className="flex flex-col gap-3 p-5 outline-none">
                    <Heading slot="title" className="text-base font-semibold">
                        {title}
                    </Heading>
                    {children}
                </AriaDialog>
            </Modal>
        </ModalOverlay>
    );
}
