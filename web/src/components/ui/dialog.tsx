import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
    Dialog as AriaDialog,
    Heading,
    Modal,
    ModalOverlay,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogProps = {
    title: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
    // `lg` para formulários longos: o conteúdo rola dentro do diálogo. `xl` é largo (campos ao lado
    // de uma vista), tem altura fixa (não muda com o conteúdo) e ocupa a tela toda abaixo de 768 px.
    size?: "md" | "lg" | "xl";
};

export function Dialog({
    title,
    open,
    onOpenChange,
    children,
    size = "md",
}: DialogProps) {
    const { t } = useTranslation("common");

    return (
        <ModalOverlay
            isOpen={open}
            onOpenChange={onOpenChange}
            isDismissable
            className="overlay-motion fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
            <Modal
                className={cn(
                    "modal-motion w-full rounded-lg border border-border bg-surface text-foreground shadow-xl",
                    size === "md" && "max-w-md",
                    size === "lg" &&
                        "max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto",
                    size === "xl" &&
                        "h-[min(48rem,calc(100dvh-2rem))] max-w-5xl",
                )}
            >
                <AriaDialog
                    className={cn(
                        "flex flex-col gap-3 p-5 outline-none",
                        size === "xl" && "h-full",
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <Heading
                            slot="title"
                            className="text-base font-semibold"
                        >
                            {title}
                        </Heading>
                        <Button
                            variant="quiet"
                            aria-label={t("dialog.close")}
                            onPress={() => onOpenChange(false)}
                            className="-mt-1 -mr-2 size-8 shrink-0 px-0"
                        >
                            <X aria-hidden="true" className="size-4" />
                        </Button>
                    </div>
                    {size === "xl" ? (
                        // O cabeçalho fica parado e só o corpo rola, com uma barra só. O respiro de 4 px em volta evita
                        // que a rolagem corte a borda e o contorno de foco do que fica rente à beirada.
                        <div className="-m-1 mr-[-0.5rem] min-h-0 flex-1 overflow-y-auto p-1 pr-2 [scrollbar-gutter:stable]">
                            {children}
                        </div>
                    ) : (
                        children
                    )}
                </AriaDialog>
            </Modal>
        </ModalOverlay>
    );
}
