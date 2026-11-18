import { useState } from "react";
import {
    FieldError,
    Focusable,
    Input,
    Label,
    NumberField,
    Text,
    useLocale,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { useNumberEntry } from "@/hooks/use-number-entry";
import { EXAMPLES, PARAMETERS, withinRange } from "@/lib/parameters";
import type { Requirement } from "@/lib/requirements";
import type { ParameterKey } from "@/lib/parameters";
import { fromSi, toSi } from "@/lib/units/convert";
import { formatOptionsFor, formatQuantity } from "@/lib/units/format";
import { QUANTITIES, findUnit } from "@/lib/units/quantities";
import type { UnitId } from "@/lib/units/quantities";
import { cn } from "@/lib/utils";
import { Menu } from "./menu";
import { StatusIndicator } from "./status-indicator";
import type { FieldStatus } from "./status-indicator";
import { HelpTip, useHoverless } from "./help-tip";
import { Tooltip } from "./tooltip";

type ParameterFieldProps = {
    parameter: ParameterKey;
    valueSi: number | undefined;
    // `undefined` quando o campo é esvaziado (o valor deixa de ser digitado).
    onChangeSi: (si: number | undefined) => void;
    unit: UnitId;
    onUnitChange?: (unit: UnitId) => void;
    status?: FieldStatus;
    statusMessage?: string;
    // Valor calculado dos outros parâmetros, mostrado apagado enquanto nada for digitado.
    derivedSi?: number;
    derivedLabel?: string;
    // Valor já inserido no campo por cálculo dos outros: aparece o texto, o valor segue editável.
    calculatedLabel?: string;
    // `row`: nome por extenso à esquerda e caixa de largura fixa à direita (formulários de
    // configuração); `stacked`: nome curto em cima e caixa embaixo, para três campos lado a lado;
    // `compact`: o mesmo, com o símbolo (Vb, Fb, Ql) no lugar do nome;
    // `symbol` (padrão): símbolo curto, para as grades do driver e da caixa.
    layout?: "symbol" | "row" | "stacked" | "compact";
    // Campo indispensável para algum cálculo: ganha um asterisco e a explicação na ajuda.
    requirement?: Requirement;
    disabled?: boolean;
    // Prefixo só para o leitor de tela, quando o mesmo campo se repete (ex.: "Item 2" do estoque).
    labelContext?: string;
    className?: string;
};

const BORDER: Record<FieldStatus, string> = {
    none: "border-border",
    ok: "border-border",
    unchecked: "border-border",
    warn: "border-status-warn",
    error: "border-status-error",
};

export function ParameterField({
    parameter,
    valueSi,
    onChangeSi,
    unit,
    onUnitChange,
    status = "none",
    statusMessage,
    derivedSi,
    derivedLabel,
    calculatedLabel,
    layout = "symbol",
    requirement,
    disabled = false,
    labelContext,
    className,
}: ParameterFieldProps) {
    const { t } = useTranslation(["parameters", "common"]);
    const { locale } = useLocale();
    const [outOfRange, setOutOfRange] = useState(false);
    const hoverless = useHoverless();
    const entryRef = useNumberEntry(locale);
    const definition = PARAMETERS[parameter];
    const units = QUANTITIES[definition.quantity].units;
    const symbol = findUnit(unit).symbol;
    const row = layout === "row";
    const compact = layout === "compact";
    const stacked = layout === "stacked" || compact;
    const bareExample = !row;
    // "Proporção — altura" → mostra só "altura"; o nome acessível mantém o texto inteiro.
    const fullLabel = t(`${parameter}.label`);
    const cut = fullLabel.lastIndexOf("—");
    const shortLabel = cut < 0 ? fullLabel : fullLabel.slice(cut + 1).trim();
    const labelPrefix = cut < 0 ? "" : fullLabel.slice(0, cut + 1) + " ";
    const help = [
        t(`${parameter}.help`),
        requirement === undefined ? "" : t(`common:required.${requirement}`),
    ]
        .filter((part) => part !== "")
        .join(" ");
    const derived = valueSi === undefined && derivedSi !== undefined;
    const shownSi = valueSi ?? derivedSi;
    const displayed =
        shownSi === undefined ? Number.NaN : fromSi(shownSi, unit);

    // A ajuda abre também pelo campo numérico (hover ou foco); a descrição abaixo continua
    // `sr-only` para o leitor de tela, então o campo nunca muda de tamanho ao receber foco.
    const input = (
        <Input
            ref={entryRef}
            placeholder={
                // Fora do layout de linha a caixa é estreita (até três por linha) e só comporta o
                // número; o "Ex." tomaria o lugar dele.
                bareExample
                    ? formatQuantity(EXAMPLES[parameter], unit, locale)
                    : t("common:placeholder.example", {
                          value: formatQuantity(
                              EXAMPLES[parameter],
                              unit,
                              locale,
                          ),
                      })
            }
            className={cn(
                "num h-full w-full min-w-0 bg-transparent text-left text-sm outline-none",
                stacked ? "px-2" : "px-2.5",
                derived ? "text-muted" : "text-foreground",
            )}
        />
    );

    return (
        <NumberField
            value={displayed}
            onChange={(value) => {
                if (!Number.isFinite(value)) {
                    setOutOfRange(false);
                    onChangeSi(undefined);
                    return;
                }

                // Sair do campo sem editar devolve o texto arredondado da tela: não é uma edição,
                // e aceitá-la trocaria o valor exato (ou o calculado) pelo arredondado.
                const step = 10 ** -findUnit(unit).decimals;

                if (
                    Number.isFinite(displayed) &&
                    Math.abs(value - displayed) <= step / 2
                ) {
                    setOutOfRange(false);
                    return;
                }

                const si = toSi(value, unit);

                // Valor impossível não entra no rascunho: o campo volta ao último valor válido e
                // mostra o motivo.
                if (!withinRange(parameter, si)) {
                    setOutOfRange(true);
                    return;
                }

                setOutOfRange(false);
                onChangeSi(si);
            }}
            formatOptions={formatOptionsFor(unit)}
            isInvalid={outOfRange}
            isDisabled={disabled}
            isRequired={requirement !== undefined}
            validationBehavior="aria"
            className={cn("group flex min-w-0 flex-col gap-0.5", className)}
        >
            {/* Linha compacta: símbolo à esquerda, valor e unidade à direita, numa caixa só. */}
            <div
                className={cn(
                    "flex gap-2",
                    stacked ? "flex-col gap-1" : "items-center",
                )}
            >
                <Label
                    className={cn(
                        row &&
                            "min-w-0 flex-1 text-[13px] leading-tight text-foreground",
                        stacked &&
                            "truncate text-[11px] leading-4 font-semibold text-muted first-letter:uppercase",
                        !row &&
                            !stacked &&
                            "w-11 shrink-0 truncate text-[13px] font-semibold text-muted",
                    )}
                >
                    {labelContext !== undefined && (
                        <span className="sr-only">{labelContext}: </span>
                    )}
                    <HelpTip
                        content={help}
                        label={t("common:help.of", {
                            parameter: definition.symbol,
                        })}
                    >
                        <span tabIndex={-1} className="cursor-help">
                            {row || (stacked && !compact) ? (
                                <>
                                    {/* O nome acessível continua começando pelo símbolo. */}
                                    <span className="sr-only">
                                        {definition.symbol} —{" "}
                                        {stacked && labelPrefix}
                                    </span>
                                    {row ? fullLabel : shortLabel}
                                </>
                            ) : (
                                definition.symbol
                            )}
                        </span>
                    </HelpTip>
                    {requirement !== undefined && (
                        // Só visual: o leitor de tela recebe "obrigatório" pelo próprio campo.
                        <span
                            aria-hidden="true"
                            className="ml-0.5 font-bold text-status-warn"
                        >
                            *
                        </span>
                    )}
                    {(compact || (!row && !stacked)) && (
                        <span className="sr-only">
                            {" "}
                            — {t(`${parameter}.label`)}
                        </span>
                    )}
                </Label>
                <div
                    className={cn(
                        "flex h-8 items-stretch overflow-hidden rounded-md border bg-raised motion-safe:transition-colors group-data-[disabled]:border-dashed group-data-[disabled]:bg-transparent group-focus-within:border-accent group-focus-within:bg-surface",
                        row
                            ? "w-32 shrink-0"
                            : stacked
                              ? "w-full"
                              : "min-w-0 flex-1",
                        outOfRange ? "border-status-error" : BORDER[status],
                    )}
                >
                    {hoverless ? (
                        input
                    ) : (
                        <Tooltip content={help}>
                            <Focusable>{input}</Focusable>
                        </Tooltip>
                    )}
                    {units.length > 1 &&
                    onUnitChange !== undefined &&
                    !disabled ? (
                        <div className="flex shrink-0 items-center border-l border-border bg-background/60">
                            <Menu<UnitId>
                                label={t("common:units.change", {
                                    parameter: definition.symbol,
                                })}
                                triggerLabel={t("common:units.changeFrom", {
                                    unit: symbol,
                                    parameter: definition.symbol,
                                })}
                                trigger={symbol}
                                items={units.map((item) => ({
                                    id: item.id,
                                    label: item.symbol,
                                }))}
                                selected={unit}
                                onAction={onUnitChange}
                                triggerClassName={cn(
                                    "flex h-full items-center justify-center text-xs text-muted motion-safe:transition-colors data-[hovered]:bg-raised data-[hovered]:text-foreground",
                                    stacked ? "min-w-8 px-1.5" : "min-w-9 px-2",
                                )}
                            />
                        </div>
                    ) : (
                        symbol !== "" && (
                            <span
                                className={cn(
                                    "flex shrink-0 items-center justify-center border-l border-border bg-background/60 text-xs text-muted",
                                    stacked ? "min-w-8 px-1.5" : "min-w-9 px-2",
                                )}
                            >
                                {symbol}
                            </span>
                        )
                    )}
                </div>
            </div>
            {/* Status e "calculado" ficam numa linha curta sob o valor, só quando dizem algo: o estado
                neutro "sem verificação" não aparece (repaginação da bancada). */}
            {(derived ||
                calculatedLabel !== undefined ||
                (status !== "none" && status !== "unchecked")) && (
                <div className={row || stacked ? "" : "pl-13"}>
                    {derived || calculatedLabel !== undefined ? (
                        <span className="text-[11px] leading-4 text-muted">
                            {derived ? derivedLabel : calculatedLabel}
                        </span>
                    ) : (
                        <ConsistencyStatus
                            status={status}
                            message={statusMessage}
                        />
                    )}
                </div>
            )}
            <Text slot="description" className="sr-only">
                {help}
            </Text>
            <FieldError
                className={cn(
                    "text-[11px] text-status-error",
                    !row && !stacked && "pl-13",
                )}
            >
                {t("common:validation.outOfRange", {
                    min: formatQuantity(definition.min, unit, locale),
                    max: formatQuantity(definition.max, unit, locale),
                    unit: symbol === "" ? "" : ` ${symbol}`,
                })}
            </FieldError>
        </NumberField>
    );
}

// Desvio de consistência é aviso para conferir, não erro: "Verificar", com o detalhe num
// tooltip (popover no toque) em vez de um parágrafo que alarga o campo.
function ConsistencyStatus({
    status,
    message,
}: {
    status: FieldStatus;
    message?: string;
}) {
    const { t } = useTranslation("common");
    const flagged = status === "warn" || status === "error";
    const indicator = (
        <StatusIndicator
            status={status}
            size="compact"
            label={flagged ? t(`consistency.${status}`) : undefined}
            shortLabel={flagged ? t("consistency.short") : undefined}
        />
    );

    if (message === undefined) {
        return indicator;
    }

    return (
        <>
            <HelpTip content={message} label={t("consistency.details")}>
                <span tabIndex={0} className="cursor-help">
                    {indicator}
                </span>
            </HelpTip>
            <span className="sr-only">{message}</span>
        </>
    );
}
