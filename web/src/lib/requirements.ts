import { ABSOLUTE_NEEDS, RESPONSE_NEEDS, requiredBoxFields } from '@/engine';
import type { BoxType } from '@/engine';
import type { ParameterKey } from '@/lib/parameters';

// Para que serve um campo sem o qual alguma curva não existe: `response` (SPL e atraso de grupo),
// `absolute` (impedância e excursão, que precisam da escala elétrica e mecânica do driver), `box`
// (as medidas da caixa do tipo escolhido) e `signal` (o sinal de entrada, para a excursão).
export type Requirement = 'response' | 'absolute' | 'box' | 'signal';

// A regra vem do próprio motor (as mesmas listas que `simulate` usa para dizer o que falta), então
// o asterisco da interface nunca discorda do aviso "falta informar".
export function requirementOf(
    key: ParameterKey,
    box: BoxType,
    signalMode: 'power' | 'voltage',
): Requirement | undefined {
    if ((RESPONSE_NEEDS as string[]).includes(key)) {
        return 'response';
    }

    if ((ABSOLUTE_NEEDS as string[]).includes(key)) {
        return 'absolute';
    }

    if ((requiredBoxFields(box) as string[]).includes(key)) {
        return 'box';
    }

    if (key === (signalMode === 'voltage' ? 'voltage_v' : 'power_w')) {
        return 'signal';
    }

    return undefined;
}
