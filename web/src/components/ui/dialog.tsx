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
    // `lg` para formulários longos: o conteúdo rola dentro do diálogo.
    size?: 'md' | 'lg';
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
                    size === 'lg'
                        ? 'max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto'
                        : 'max-w-md',
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
