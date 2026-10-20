import type { ReactNode } from 'react';
import {
    Dialog as AriaDialog,
    Heading,
    Modal,
    ModalOverlay,
} from 'react-aria-components';

type DialogProps = {
    title: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
};

export function Dialog({ title, open, onOpenChange, children }: DialogProps) {
    return (
        <ModalOverlay
            isOpen={open}
            onOpenChange={onOpenChange}
            isDismissable
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
            <Modal className="w-full max-w-md rounded-lg border border-border bg-surface text-foreground shadow-xl">
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
