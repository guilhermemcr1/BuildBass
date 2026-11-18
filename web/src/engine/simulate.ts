import { withVoiceCoils } from './voice-coils';
import { bandEdges, rearLossReferenceHz, rearNetVolume } from './bandpass';
import { solveCircuit } from './circuit';
import type { CircuitParams } from './circuit';
import { abs, arg, complex, mul } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { deriveDriver } from './driver';
import { ANALYSIS_FREQUENCIES_HZ, FREQUENCIES_HZ } from './frequencies';
import {
    endFactor,
    netVolume as solveNetVolume,
    pipeResonance,
    portArea,
    tuningForLength,
} from './port';
import { twoChambers } from './types';
import type {
    BoxFill,
    BoxType,
    CurveId,
    DriverKey,
    EngineWarning,
    FieldKey,
    PortInput,
    ProjectInput,
    Simulation,
    SimulationResults,
    WarningId,
} from './types';

const RHO_C2 = AIR_DENSITY * SPEED_OF_SOUND ** 2;
// Pressão de referência do SPL e distância de medição.
const P_REF = 20e-6;
// Piso do nível (−120 dB SPL): a bandpass de 6ª ordem pode cancelar a saída por completo (duas
// sintonias iguais), e o logaritmo de zero não é um número que o gráfico possa desenhar.
const P_FLOOR = P_REF * 1e-6;
// Duto da câmara traseira ainda não preenchido (bandpass de 6ª ordem).
const NO_PORT: PortInput = { shape: 'round', count: 1 };
const DISTANCE_M = 1;
// Área usada só no modo normalizado, em que o nível absoluto não importa.
const NORMALIZED_SD = 0.05;
// Perdas por absorção QA por material ([S73v]): a regra de uso do WinISD e do Unibox, ~30 com as
// paredes revestidas e ~10 com a câmara preenchida, não um valor medido.
const FILL_QA: Record<BoxFill, number> = {
    none: Number.POSITIVE_INFINITY,
    lined: 30,
    stuffed: 10,
};
// A 1ª ressonância de tubo precisa ficar acima das duas oitavas acima da sintonia (4·Fb), onde a
// caixa trabalha, e de 3× o passa-baixa típico de subwoofer (80 Hz), a regra mais citada nos guias.
const PIPE_MARGIN = 4;
const PIPE_MIN_HZ = 3 * 80;

export const RESPONSE_NEEDS: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];
// Para nível absoluto, excursão e impedância: escala elétrica e mecânica do driver.
export const ABSOLUTE_NEEDS: DriverKey[] = ['re_ohm', 'sd_m2', 'qms'];

// Medidas da caixa sem as quais não há resposta, por tipo: o volume (ou os das duas câmaras no
// bandpass), a sintonia do duto nos tipos dutados e a da câmara traseira na 6ª ordem. A interface
// marca esses campos como obrigatórios com a mesma regra que `simulate` usa para dizer o que falta.
export function requiredBoxFields(type: BoxType): FieldKey[] {
    return [
        ...(twoChambers(type)
            ? (['vr_m3', 'vf_m3'] as const)
            : (['vb_m3'] as const)),
        ...(type === 'closed' ? [] : (['fb_hz'] as const)),
        ...(type === 'bandpass6' ? (['fb_rear_hz'] as const) : []),
    ];
}

type Model = {
    perDriver: CircuitParams;
    // Sem perdas por indutância, para o F3.
    lowFrequency: CircuitParams;
    count: number;
    series: boolean;
    // Tensão eficaz em cada driver (1 V no modo normalizado).
    voltage: number;
    solidAngle: number;
    // Pressão da banda de passagem (assíntota sem Le), para normalizar e achar o F3.
    passbandPressure: number;
};

// Medidas que faltam para a área do duto, pela forma. O duto da câmara traseira (bandpass de 6ª
// ordem) usa as mesmas medidas com o prefixo `rear_`.
function portMissing(port: PortInput, rear = false): FieldKey[] {
    const key = (name: string) => (rear ? `rear_${name}` : name) as FieldKey;

    switch (port.shape) {
        case 'round':
            return port.diameter_m === undefined ? [key('diameter_m')] : [];
        case 'rect':
            return [
                ...(port.width_m === undefined ? [key('width_m')] : []),
                ...(port.height_m === undefined ? [key('height_m')] : []),
            ];
        case 'triangle':
            return [
                ...(port.base_m === undefined ? [key('base_m')] : []),
                ...(port.height_m === undefined ? [key('height_m')] : []),
            ];
    }
}

type DuctedChamber = {
    // Volume líquido: bruto − drivers − dutos (≤ 0 quando nada cabe).
    net_m3: number;
    length_m?: number;
    // Volume dos dutos (n·a·L) e a 1ª ressonância de tubo.
    port_m3?: number;
    pipe_hz?: number;
    // false quando os drivers ou os dutos não cabem na câmara.
    fits: boolean;
    warnings: EngineWarning[];
};

type DuctedChamberInput = {
    volume_m3: number;
    drivers_m3: number;
    fb_hz?: number;
    area_m2?: number;
    count: number;
    end_factor: number;
    // Aviso quando só os drivers já não cabem (volume líquido ≤ 0).
    invalid: WarningId;
    chamber?: 'rear' | 'front';
};

// Câmara com duto: volume líquido, comprimento do duto e avisos (research.md §7 da 002; usada pela
// dutada, pela câmara frontal e pela traseira da 6ª ordem, sem equação repetida). O volume dos
// dutos sai da câmara e o comprimento depende do volume líquido (`port.ts`).
function ductedChamber({
    volume_m3,
    drivers_m3,
    fb_hz,
    area_m2,
    count,
    end_factor,
    invalid,
    chamber,
}: DuctedChamberInput): DuctedChamber {
    const tag = (
        id: WarningId,
        values?: Record<string, number>,
    ): EngineWarning => ({
        id,
        ...(chamber === undefined ? {} : { chamber }),
        ...(values === undefined ? {} : { values }),
    });
    const available = volume_m3 - drivers_m3;

    if (available <= 0) {
        return { net_m3: available, fits: false, warnings: [tag(invalid)] };
    }

    if (area_m2 === undefined || fb_hz === undefined) {
        return { net_m3: available, fits: true, warnings: [] };
    }

    const solved = solveNetVolume({
        vb_m3: volume_m3,
        drivers_m3,
        fb_hz,
        area_m2,
        count,
        end_factor,
    });

    if (Number.isNaN(solved.length_m)) {
        return {
            net_m3: solved.net_m3,
            fits: false,
            warnings: [tag('portVolumeTooLarge')],
        };
    }

    const warnings: EngineWarning[] = [];
    const pipe_hz =
        solved.length_m > 0
            ? pipeResonance(solved.length_m, area_m2, end_factor)
            : undefined;

    if (solved.length_m <= 0) {
        warnings.push(tag('portTooShort'));
    } else if (
        (pipe_hz as number) < Math.max(PIPE_MARGIN * fb_hz, PIPE_MIN_HZ)
    ) {
        // A ressonância do tubo vaza pelo duto como um pico estreito dentro da faixa tocada (no lugar
        // da regra antiga, L > ∛Vb, que disparava em projetos comuns de subwoofer).
        warnings.push(
            tag('portTooLong', {
                length_m: solved.length_m,
                pipe_hz: pipe_hz as number,
            }),
        );
    }

    return {
        net_m3: solved.net_m3,
        length_m: solved.length_m,
        port_m3: solved.port_m3,
        pipe_hz,
        fits: true,
        warnings,
    };
}

function missingFrom(
    values: Partial<Record<DriverKey, number>>,
    keys: DriverKey[],
): FieldKey[] {
    return keys.filter((key) => values[key] === undefined);
}

function emptyMissing(): Record<CurveId, FieldKey[]> {
    return {
        spl_db: [],
        excursion_m: [],
        impedance_ohm: [],
        group_delay_s: [],
        port_velocity_ms: [],
        port_rear_velocity_ms: [],
    };
}

// Pressão eficaz a r = 1 m de uma fonte de volume U: p = ω·ρ·|U| / (Ω·r), com Ω = 2π (meio
// espaço) ou 4π (espaço livre) ([L10] cap. 2).
function pressure(volumeVelocity: number, omega: number, solidAngle: number) {
    return (omega * AIR_DENSITY * volumeVelocity) / (solidAngle * DISTANCE_M);
}

function levelDb(rmsPressure: number): number {
    return 20 * Math.log10(Math.max(rmsPressure, P_FLOOR) / P_REF);
}

function unwrap(phases: number[]): number[] {
    const result = [...phases];

    for (let index = 1; index < result.length; index++) {
        let delta = result[index] - result[index - 1];

        while (delta > Math.PI) {
            result[index] -= 2 * Math.PI;
            delta -= 2 * Math.PI;
        }

        while (delta < -Math.PI) {
            result[index] += 2 * Math.PI;
            delta += 2 * Math.PI;
        }
    }

    return result;
}

// Atraso de grupo τ = −dφ/dω por diferenças centrais.
// Os máximos e os cortes valem só na grade de análise; as curvas vão além, até 20 kHz.
function analysisPart(values: number[]): number[] {
    return values.slice(0, ANALYSIS_FREQUENCIES_HZ.length);
}

function groupDelay(
    phases: number[],
    frequencies: readonly number[],
): number[] {
    const unwrapped = unwrap(phases);
    const last = frequencies.length - 1;

    return frequencies.map((_, index) => {
        const before = Math.max(0, index - 1);
        const after = Math.min(last, index + 1);
        const dOmega = 2 * Math.PI * (frequencies[after] - frequencies[before]);

        return -(unwrapped[after] - unwrapped[before]) / dOmega;
    });
}

// Nível relativo à banda de passagem no modelo de baixas frequências.
function relativeLevel(model: Model, frequency: number): number {
    const omega = 2 * Math.PI * frequency;
    const point = solveCircuit(model.lowFrequency, frequency);
    const radiated = abs(point.radiated) * model.voltage * model.count;

    return (
        levelDb(pressure(radiated, omega, model.solidAngle)) -
        levelDb(model.passbandPressure)
    );
}

// Corte de `dropDb` dB: da frequência mais alta para a mais baixa, o primeiro ponto `dropDb` dB
// abaixo da banda; o cruzamento é refinado por bisseção em log f. Com 3 dB é o
// F3; com 10 dB, o F-10 que a exportação do gráfico mostra.
function findCutoff(
    model: Model,
    dropDb: number,
): { frequency?: number; below: boolean } {
    const grid = ANALYSIS_FREQUENCIES_HZ;

    for (let index = grid.length - 1; index >= 0; index--) {
        if (relativeLevel(model, grid[index]) >= -dropDb) {
            continue;
        }

        if (index === grid.length - 1) {
            return { below: false };
        }

        let low = Math.log(grid[index]);
        let high = Math.log(grid[index + 1]);

        for (let step = 0; step < 50; step++) {
            const middle = (low + high) / 2;

            if (relativeLevel(model, Math.exp(middle)) < -dropDb) {
                low = middle;
            } else {
                high = middle;
            }
        }

        return { frequency: Math.exp((low + high) / 2), below: false };
    }

    return { below: true };
}

export type SignalLevels = {
    // Resistência DC do conjunto: série N·Re, paralelo Re/N.
    re_total_ohm?: number;
    voltage_v?: number;
    power_w?: number;
};

// Sinal: watts e volts se convertem pela resistência DC do conjunto,
// V = √(P·Re_tot). O modo diz qual dos dois foi digitado.
export function signalLevels(project: ProjectInput): SignalLevels {
    return levelsOf(withVoiceCoils(project));
}

// Igual a `signalLevels`, com as bobinas já ligadas (o `simulate` transforma uma vez só).
function levelsOf({ driver, drivers, signal }: ProjectInput): SignalLevels {
    const count = Math.max(1, Math.round(drivers.count));
    const re = driver.re_ohm;
    const reTotal =
        re === undefined
            ? undefined
            : drivers.wiring === 'series'
              ? count * re
              : re / count;

    if (signal.mode === 'voltage') {
        const voltage = signal.voltage_v;

        return {
            re_total_ohm: reTotal,
            voltage_v: voltage,
            power_w:
                reTotal === undefined || voltage === undefined
                    ? undefined
                    : voltage ** 2 / reTotal,
        };
    }

    const power = signal.power_w;

    return {
        re_total_ohm: reTotal,
        voltage_v:
            reTotal === undefined || power === undefined
                ? undefined
                : Math.sqrt(power * reTotal),
        power_w: power,
    };
}

// Troca a sintonia gravada pela que a profundidade informada dá (duto frontal e, na 6ª ordem, o
// traseiro). Na bandpass os drivers ficam na câmara traseira: a frontal só perde o duto.
export function tunedByLength(
    box: ProjectInput['box'],
    drivers_m3: number,
): ProjectInput['box'] {
    const band = twoChambers(box.type);
    const tune = (
        port: PortInput | undefined,
        volume: number | undefined,
        chamberDrivers: number,
    ): number | undefined => {
        const area = port === undefined ? undefined : portArea(port);

        if (
            port?.length_m === undefined ||
            volume === undefined ||
            area === undefined
        ) {
            return undefined;
        }

        return tuningForLength({
            length_m: port.length_m,
            vb_m3: volume,
            drivers_m3: chamberDrivers,
            area_m2: area,
            count: Math.max(1, Math.round(port.count)),
            end_factor: endFactor(port),
        });
    };
    let next = box;

    if (box.type !== 'closed' && box.port.length_m !== undefined) {
        const fb = tune(
            box.port,
            band ? box.vf_m3 : box.vb_m3,
            band ? 0 : drivers_m3,
        );
        const { fb_hz: _old, ...rest } = next;

        next = fb === undefined ? rest : { ...rest, fb_hz: fb };
    }

    if (box.type === 'bandpass6' && box.port_rear?.length_m !== undefined) {
        const fb = tune(box.port_rear, box.vr_m3, drivers_m3);
        const { fb_rear_hz: _old, ...rest } = next;

        next = fb === undefined ? rest : { ...rest, fb_rear_hz: fb };
    }

    return next;
}

export function simulate(input: ProjectInput): Simulation {
    // Bobina dupla em paralelo: Re, Le e BL vistos dos terminais (voice-coils.ts).
    const project = withVoiceCoils(input);
    const derived = deriveDriver(project.driver);
    const values: Partial<Record<DriverKey, number>> = {};

    for (const [key, entry] of Object.entries(derived.values)) {
        if (entry.value !== undefined) {
            values[key as DriverKey] = entry.value;
        }
    }

    const { drivers, signal } = project;
    // Duto com profundidade informada: a sintonia sai dela.
    const box = tunedByLength(
        project.box,
        Math.max(1, Math.round(drivers.count)) * (values.vd_m3 ?? 0),
    );
    // Duas câmaras separadas pelo driver: bandpass de 4ª (traseira selada) e de 6ª ordem (as duas
    // dutadas).
    const band = twoChambers(box.type);
    const band6 = box.type === 'bandpass6';
    // Tipos com duto: a dutada e as bandpass (o duto da câmara frontal; na 6ª ordem, também o da
    // traseira).
    const ported = box.type !== 'closed';
    const rearPort = box.port_rear ?? NO_PORT;
    const missing = emptyMissing();
    const warnings: EngineWarning[] = [];
    const results: SimulationResults = {};

    const boxMissing = requiredBoxFields(box.type).filter(
        (key) => box[key as keyof typeof box] === undefined,
    );

    const responseMissing = [
        ...missingFrom(values, RESPONSE_NEEDS),
        ...boxMissing,
    ];
    const absoluteMissing = missingFrom(values, ABSOLUTE_NEEDS);
    const count = Math.max(1, Math.round(drivers.count));
    const series = drivers.wiring === 'series';

    const levels = levelsOf(project);
    const reTotal = levels.re_total_ohm;
    const voltage = levels.voltage_v;

    // Falta o sinal só quando o próprio campo está vazio ou zerado (sem Re, quem falta é o Re).
    const signalValue =
        signal.mode === 'voltage' ? signal.voltage_v : signal.power_w;
    const signalMissing: FieldKey[] =
        signalValue === undefined || signalValue <= 0
            ? [signal.mode === 'voltage' ? 'voltage_v' : 'power_w']
            : [];

    if (reTotal !== undefined && voltage !== undefined) {
        results.voltage_v = voltage;
        results.power_w = levels.power_w;
        results.impedance_total_ohm = reTotal;
    }

    // Potência térmica do conjunto: N·Pe ([D06]; Pe é por driver).
    if (
        values.pe_w !== undefined &&
        levels.power_w !== undefined &&
        levels.power_w > count * values.pe_w
    ) {
        warnings.push({
            id: 'aboveThermalPower',
            values: { power_w: levels.power_w, limit_w: count * values.pe_w },
        });
    }

    missing.spl_db = responseMissing;
    missing.group_delay_s = responseMissing;
    missing.impedance_ohm = [...responseMissing, ...absoluteMissing];
    missing.excursion_m = [
        ...responseMissing,
        ...absoluteMissing,
        ...signalMissing,
    ];
    missing.port_velocity_ms = ported
        ? [...missing.excursion_m, ...portMissing(box.port)]
        : [];
    missing.port_rear_velocity_ms = band6
        ? [...missing.excursion_m, ...portMissing(rearPort, true)]
        : [];

    // Eficiência de referência η0 = (4π²/c³)·Fs³·Vas/Qes ([S72] eq. 26), N vezes para N drivers.
    if (
        values.fs_hz !== undefined &&
        values.vas_m3 !== undefined &&
        values.qes !== undefined
    ) {
        const eta0 =
            ((4 * Math.PI ** 2) / SPEED_OF_SOUND ** 3) *
            values.fs_hz ** 3 *
            (values.vas_m3 / values.qes);
        results.efficiency = count * eta0;
        // Nível a 1 W/1 m em meio espaço: 10·log10(ρc·η / (2π·p_ref²)) ≈ 112,1 + 10·log10 η
        // ([D06]).
        results.spl0_db =
            10 *
            Math.log10(
                (AIR_DENSITY * SPEED_OF_SOUND * results.efficiency) /
                    (2 * Math.PI * P_REF ** 2),
            );
    }

    if (ported && box.fb_hz !== undefined) {
        results.fb_hz = box.fb_hz;
    }

    if (band6 && box.fb_rear_hz !== undefined) {
        results.fb_rear_hz = box.fb_rear_hz;
    }

    const empty = (): Simulation => ({
        frequencies_hz: FREQUENCIES_HZ,
        curves: {},
        spl_normalized: true,
        missing,
        results,
        warnings,
    });

    // Já sem faltas: o volume que leva o duto (a caixa, ou a câmara frontal da bandpass) existe.
    const chamber = (band ? box.vf_m3 : box.vb_m3) as number | undefined;

    if (responseMissing.length > 0 || chamber === undefined) {
        return empty();
    }

    const driversVolume = count * (values.vd_m3 ?? 0);
    const portCount = Math.max(1, Math.round(box.port.count));
    const area = ported ? portArea(box.port) : undefined;
    const rearPortCount = Math.max(1, Math.round(rearPort.count));
    const rearArea = band6 ? portArea(rearPort) : undefined;
    let rearNet: number | undefined;
    let failed = false;

    // Bandpass de 4ª ordem: o magneto do driver fica na câmara traseira selada ([D06]).
    if (box.type === 'bandpass') {
        rearNet = rearNetVolume(box.vr_m3 as number, driversVolume);
        results.net_rear_m3 = rearNet;

        if (rearNet <= 0) {
            warnings.push({ id: 'rearVolumeInvalid' });

            return empty();
        }
    }

    // Bandpass de 6ª ordem: a traseira também leva duto; o driver sai dela e cada duto sai da
    // câmara dele.
    if (band6) {
        const rear = ductedChamber({
            volume_m3: box.vr_m3 as number,
            drivers_m3: driversVolume,
            fb_hz: box.fb_rear_hz,
            area_m2: rearArea,
            count: rearPortCount,
            end_factor: endFactor(rearPort),
            invalid: 'rearVolumeInvalid',
            chamber: 'rear',
        });

        results.net_rear_m3 = rear.net_m3;

        if (rear.length_m !== undefined) {
            results.port_rear_length_m = rear.length_m;
            results.port_rear_volume_m3 = rear.port_m3;
            results.port_rear_pipe_hz = rear.pipe_hz;
        }

        warnings.push(...rear.warnings);
        failed = !rear.fits;
        rearNet = rear.net_m3;
    }

    // Na bandpass os drivers já saíram da câmara traseira; a frontal só perde o duto.
    const front = ductedChamber({
        volume_m3: chamber,
        drivers_m3: band ? 0 : driversVolume,
        fb_hz: box.fb_hz,
        area_m2: area,
        count: portCount,
        end_factor: endFactor(box.port),
        invalid: band ? 'portVolumeTooLarge' : 'netVolumeInvalid',
        chamber: band6 ? 'front' : undefined,
    });

    if (band) {
        results.net_front_m3 = front.net_m3;
    } else {
        results.net_volume_m3 = front.net_m3;
    }

    if (front.length_m !== undefined) {
        results.port_length_m = front.length_m;
        results.port_volume_m3 = front.port_m3;
        results.port_pipe_hz = front.pipe_hz;
    }

    warnings.push(...front.warnings);

    if (failed || !front.fits) {
        return empty();
    }

    const netVolume = front.net_m3;

    const fs = values.fs_hz as number;
    const qts = values.qts as number;
    const vas = values.vas_m3 as number;
    const omegaS = 2 * Math.PI * fs;

    // Cada driver vê a sua fração da caixa.
    const boxPerDriver = netVolume / count;
    const alpha = vas / boxPerDriver;
    const cab = boxPerDriver / RHO_C2;

    if (box.type === 'closed') {
        // [S73c] eq. 9–10.
        results.qtc = qts * Math.sqrt(1 + alpha);
        results.fc_hz = fs * Math.sqrt(1 + alpha);
    }

    // Perdas por vazamento: QL = ω·Ral·Cab na frequência de referência da caixa ([S73v] eq. 7).
    const referenceOmega =
        2 *
        Math.PI *
        (ported ? (box.fb_hz as number) : (results.fc_hz as number));
    const ral = box.ql / (referenceOmega * cab);
    // Absorção QA = 1 / (ω·Rab·Cab) na mesma frequência de referência ([S73v]).
    const qa = FILL_QA[box.fill ?? 'none'];
    const absorption = (omega: number, compliance: number) =>
        Number.isFinite(qa) ? 1 / (qa * omega * compliance) : undefined;
    // Massa do duto pela sintonia: Fb = 1 / (2π·√(Map·Cab)); na bandpass, Cab é o da câmara
    // frontal com o cone bloqueado.
    const map = ported
        ? 1 / ((2 * Math.PI * (box.fb_hz as number)) ** 2 * cab)
        : undefined;

    // Câmara traseira dutada da 6ª ordem: compliância por driver, massa do duto pela sintonia dela
    // e perdas medidas nessa sintonia, como na dutada ([S73v] eq. 7).
    const rearChamber = (perDriver_m3: number, tuning_hz: number) => {
        const rearOmega = 2 * Math.PI * tuning_hz;
        const rearCab = perDriver_m3 / RHO_C2;

        return {
            cab: rearCab,
            ral: box.ql / (rearOmega * rearCab),
            map: 1 / (rearOmega ** 2 * rearCab),
            rab: absorption(rearOmega, rearCab),
        };
    };

    // A forma da resposta depende só de Fs, Qts e Vas; Re, Sd e Qms dão a escala absoluta.
    const absolute = absoluteMissing.length === 0;
    const sd = absolute ? (values.sd_m2 as number) : NORMALIZED_SD;
    const re = absolute ? (values.re_ohm as number) : 1;
    const qms = absolute ? (values.qms as number) : Number.POSITIVE_INFINITY;
    const qes = Number.isFinite(qms) ? (qts * qms) / (qms - qts) : qts;
    const cms = vas / (RHO_C2 * sd ** 2);
    const mms = 1 / (omegaS ** 2 * cms);
    // Le em 1 kHz e em 10 kHz: bobina de Leach, Z = K·(jω)^n, com a indutância efetiva Im(Z)/ω
    // passando pelos dois pontos: n = 1 − log10(Le1k/Le10k), K = Le1k·ω1^(1−n) / sin(nπ/2).
    const le1k = values.le_h;
    const le10k = values.le10k_h;
    let leach: CircuitParams['leach'];

    if (
        absolute &&
        le1k !== undefined &&
        le1k > 0 &&
        le10k !== undefined &&
        le10k > 0
    ) {
        const n = Math.min(1, Math.max(0.05, 1 - Math.log10(le1k / le10k)));
        const omega1k = 2 * Math.PI * 1000;

        leach = {
            n,
            k: (le1k * omega1k ** (1 - n)) / Math.sin((n * Math.PI) / 2),
        };
    }

    const rearPerDriver = rearNet === undefined ? undefined : rearNet / count;
    const sealedRearOmega =
        rearPerDriver === undefined
            ? 0
            : 2 * Math.PI * rearLossReferenceHz(fs, vas, rearPerDriver);
    const perDriver: CircuitParams = {
        re,
        le: absolute ? (values.le_h ?? 0) : 0,
        leach,
        bl: Math.sqrt((omegaS * mms * re) / qes),
        mms,
        cms,
        rms: Number.isFinite(qms) ? (omegaS * mms) / qms : 0,
        sd,
        cab,
        ral,
        rab: absorption(referenceOmega, cab),
        map,
        rear:
            rearNet === undefined
                ? undefined
                : band6
                  ? rearChamber(rearNet / count, box.fb_rear_hz as number)
                  : // Câmara traseira selada da 4ª ordem; perdas medidas na ressonância do driver.
                    {
                        cab: (rearPerDriver as number) / RHO_C2,
                        ral:
                            box.ql /
                            (sealedRearOmega *
                                ((rearPerDriver as number) / RHO_C2)),
                        rab: absorption(
                            sealedRearOmega,
                            (rearPerDriver as number) / RHO_C2,
                        ),
                    },
    };

    if (absolute && values.le_h === undefined) {
        warnings.push({ id: 'noInductance' });
    }

    const perDriverVoltage =
        absolute && voltage !== undefined && voltage > 0
            ? series
                ? voltage / count
                : voltage
            : 1;
    const solidAngle = signal.radiation === 'half' ? 2 * Math.PI : 4 * Math.PI;
    const model: Model = {
        perDriver,
        lowFrequency: { ...perDriver, le: 0, leach: undefined },
        count,
        series,
        voltage: perDriverVoltage,
        solidAngle,
        // Acima da ressonância, U → Sd·Bl·V / (Re·jω·Mms): p = ρ·Sd·Bl·V / (Re·Mms·Ω·r).
        passbandPressure:
            (AIR_DENSITY * sd * perDriver.bl * perDriverVoltage * count) /
            (re * mms * solidAngle * DISTANCE_M),
    };

    const spl: number[] = [];
    const phases: number[] = [];
    const excursion: number[] = [];
    const impedance: number[] = [];
    const portVelocity: number[] = [];
    // Área total de saída dos dutos; o fluxo de todos os drivers passa por ela.
    const totalPortArea = area === undefined ? undefined : portCount * area;
    const rearVelocity: number[] = [];
    const totalRearArea =
        rearArea === undefined ? undefined : rearPortCount * rearArea;

    for (const frequency of FREQUENCIES_HZ) {
        const omega = 2 * Math.PI * frequency;
        const point = solveCircuit(perDriver, frequency);
        const radiated = abs(point.radiated) * perDriverVoltage * count;
        const level = levelDb(pressure(radiated, omega, solidAngle));

        spl.push(absolute ? level : level - levelDb(model.passbandPressure));
        phases.push(arg(mul(complex(0, omega), point.radiated)));
        // Amplitude de pico do deslocamento: √2·|u|/ω.
        excursion.push(
            (Math.SQRT2 * abs(point.velocity) * perDriverVoltage) / omega,
        );
        const single = abs(point.impedance);
        impedance.push(series ? single * count : single / count);

        if (totalPortArea !== undefined) {
            // Velocidade de pico do ar no duto: √2·N·|Up| / (n·Sp1).
            portVelocity.push(
                (Math.SQRT2 * abs(point.port) * perDriverVoltage * count) /
                    totalPortArea,
            );
        }

        if (totalRearArea !== undefined) {
            rearVelocity.push(
                (Math.SQRT2 * abs(point.rearPort) * perDriverVoltage * count) /
                    totalRearArea,
            );
        }
    }

    const curves: Simulation['curves'] = {
        spl_db: spl,
        group_delay_s: groupDelay(phases, FREQUENCIES_HZ),
    };

    if (missing.impedance_ohm.length === 0) {
        curves.impedance_ohm = impedance;
    }

    if (missing.excursion_m.length === 0) {
        curves.excursion_m = excursion;
    }

    if (missing.port_velocity_ms.length === 0 && totalPortArea !== undefined) {
        curves.port_velocity_ms = portVelocity;
        results.port_velocity_max_ms = Math.max(...analysisPart(portVelocity));
    }

    if (
        missing.port_rear_velocity_ms.length === 0 &&
        totalRearArea !== undefined
    ) {
        curves.port_rear_velocity_ms = rearVelocity;
        results.port_rear_velocity_max_ms = Math.max(
            ...analysisPart(rearVelocity),
        );
    }

    let lowEdge: number | undefined;

    if (band) {
        // Bordas de −3 dB sobre a curva que o usuário vê (com Le, quando informada).
        // Os pontos da grade se repetem entre as buscas de −3 e de −10 dB: guardados, o circuito
        // é resolvido uma vez por frequência.
        const solved = new Map<number, number>();
        const bandLevel = (frequency: number) => {
            const known = solved.get(frequency);

            if (known !== undefined) {
                return known;
            }

            const point = solveCircuit(perDriver, frequency);
            const radiated = abs(point.radiated) * perDriverVoltage * count;
            const level = levelDb(
                pressure(radiated, 2 * Math.PI * frequency, solidAngle),
            );
            const result = absolute
                ? level
                : level - levelDb(model.passbandPressure);

            solved.set(frequency, result);

            return result;
        };
        const edges = bandEdges(bandLevel);

        results.peak_db = edges.peak_db;
        results.f_low_hz = edges.f_low_hz;
        results.f_high_hz = edges.f_high_hz;
        results.f_center_hz = edges.f_center_hz;
        results.bandwidth_oct = edges.bandwidth_oct;
        results.f_low_below_range = edges.below_range || undefined;
        results.f_high_above_range = edges.above_range || undefined;
        lowEdge = edges.f_low_hz;

        // Bordas de −10 dB sobre a mesma curva, para a legenda da exportação.
        const wide = bandEdges(bandLevel, 10);

        results.f_low10_hz = wide.f_low_hz;
        results.f_high10_hz = wide.f_high_hz;
        results.f_low10_below_range = wide.below_range || undefined;
        results.f_high10_above_range = wide.above_range || undefined;
    } else {
        const f3 = findCutoff(model, 3);
        const f10 = findCutoff(model, 10);
        results.f3_hz = f3.frequency;
        results.f3_below_range = f3.below || undefined;
        results.f10_hz = f10.frequency;
        results.f10_below_range = f10.below || undefined;
        lowEdge = f3.frequency;
    }

    // Potência que leva o cone ao Xmax: x ∝ V, então P·(Xmax/x)², a menor entre F3 (na bandpass,
    // o corte inferior) e 1000 Hz; abaixo dele a caixa já não é usada.
    if (
        curves.excursion_m !== undefined &&
        values.xmax_m !== undefined &&
        values.xmax_m > 0 &&
        results.power_w !== undefined
    ) {
        const from = lowEdge ?? ANALYSIS_FREQUENCIES_HZ[0];
        const xmax = values.xmax_m;
        const power = results.power_w;
        results.xmax_power_w = Math.min(
            ...ANALYSIS_FREQUENCIES_HZ.flatMap((frequency, index) =>
                frequency >= from
                    ? [power * (xmax / excursion[index]) ** 2]
                    : [],
            ),
        );
    }

    return {
        frequencies_hz: FREQUENCIES_HZ,
        curves,
        spl_normalized: !absolute,
        missing,
        results,
        warnings,
    };
}
