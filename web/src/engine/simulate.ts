import { solveCircuit } from './circuit';
import type { CircuitParams } from './circuit';
import { abs, arg, complex, mul } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { deriveDriver } from './driver';
import { FREQUENCIES_HZ } from './frequencies';
import { netVolume as solveNetVolume, portArea } from './port';
import type {
    CurveId,
    DriverKey,
    EngineWarning,
    FieldKey,
    PortInput,
    ProjectInput,
    Simulation,
    SimulationResults,
} from './types';

const RHO_C2 = AIR_DENSITY * SPEED_OF_SOUND ** 2;
// Pressão de referência do SPL e distância de medição.
const P_REF = 20e-6;
const DISTANCE_M = 1;
// Área usada só no modo normalizado, em que o nível absoluto não importa.
const NORMALIZED_SD = 0.05;

const RESPONSE_NEEDS: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];
// Para nível absoluto, excursão e impedância: escala elétrica e mecânica do driver.
const ABSOLUTE_NEEDS: DriverKey[] = ['re_ohm', 'sd_m2', 'qms'];

type Model = {
    perDriver: CircuitParams;
    // Sem perdas por indutância, para o F3 (research.md §8).
    lowFrequency: CircuitParams;
    count: number;
    series: boolean;
    // Tensão eficaz em cada driver (1 V no modo normalizado).
    voltage: number;
    solidAngle: number;
    // Pressão da banda de passagem (assíntota sem Le), para normalizar e achar o F3.
    passbandPressure: number;
};

// Medidas que faltam para a área do duto, pela forma.
function portMissing(port: PortInput): FieldKey[] {
    switch (port.shape) {
        case 'round':
            return port.diameter_m === undefined ? ['diameter_m'] : [];
        case 'rect':
            return [
                ...(port.width_m === undefined ? (['width_m'] as const) : []),
                ...(port.height_m === undefined ? (['height_m'] as const) : []),
            ];
        case 'triangle':
            return [
                ...(port.base_m === undefined ? (['base_m'] as const) : []),
                ...(port.height_m === undefined ? (['height_m'] as const) : []),
            ];
    }
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
    };
}

// Pressão eficaz a r = 1 m de uma fonte de volume U: p = ω·ρ·|U| / (Ω·r), com Ω = 2π (meio
// espaço) ou 4π (espaço livre) ([L10] cap. 2).
function pressure(volumeVelocity: number, omega: number, solidAngle: number) {
    return (omega * AIR_DENSITY * volumeVelocity) / (solidAngle * DISTANCE_M);
}

function levelDb(rmsPressure: number): number {
    return 20 * Math.log10(rmsPressure / P_REF);
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

// Atraso de grupo τ = −dφ/dω por diferenças centrais (research.md §9).
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

// F3: da frequência mais alta para a mais baixa, o primeiro ponto 3 dB abaixo da banda; o
// cruzamento é refinado por bisseção em log f (research.md §8).
function findF3(model: Model): { f3?: number; below: boolean } {
    const grid = FREQUENCIES_HZ;

    for (let index = grid.length - 1; index >= 0; index--) {
        if (relativeLevel(model, grid[index]) >= -3) {
            continue;
        }

        if (index === grid.length - 1) {
            return { below: false };
        }

        let low = Math.log(grid[index]);
        let high = Math.log(grid[index + 1]);

        for (let step = 0; step < 50; step++) {
            const middle = (low + high) / 2;

            if (relativeLevel(model, Math.exp(middle)) < -3) {
                low = middle;
            } else {
                high = middle;
            }
        }

        return { f3: Math.exp((low + high) / 2), below: false };
    }

    return { below: true };
}

export type SignalLevels = {
    // Resistência DC do conjunto: série N·Re, paralelo Re/N.
    re_total_ohm?: number;
    voltage_v?: number;
    power_w?: number;
};

// Sinal (research.md §6): watts e volts se convertem pela resistência DC do conjunto,
// V = √(P·Re_tot). O modo diz qual dos dois foi digitado.
export function signalLevels({
    driver,
    drivers,
    signal,
}: ProjectInput): SignalLevels {
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

export function simulate(project: ProjectInput): Simulation {
    const derived = deriveDriver(project.driver);
    const values: Partial<Record<DriverKey, number>> = {};

    for (const [key, entry] of Object.entries(derived.values)) {
        if (entry.value !== undefined) {
            values[key as DriverKey] = entry.value;
        }
    }

    const { box, drivers, signal } = project;
    const vented = box.type === 'vented';
    const missing = emptyMissing();
    const warnings: EngineWarning[] = [];
    const results: SimulationResults = {};

    const boxMissing: FieldKey[] = [];

    if (box.vb_m3 === undefined) {
        boxMissing.push('vb_m3');
    }

    if (vented && box.fb_hz === undefined) {
        boxMissing.push('fb_hz');
    }

    const responseMissing = [
        ...missingFrom(values, RESPONSE_NEEDS),
        ...boxMissing,
    ];
    const absoluteMissing = missingFrom(values, ABSOLUTE_NEEDS);
    const count = Math.max(1, Math.round(drivers.count));
    const series = drivers.wiring === 'series';

    const levels = signalLevels(project);
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
    missing.port_velocity_ms = vented
        ? [...missing.excursion_m, ...portMissing(box.port)]
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

    if (vented && box.fb_hz !== undefined) {
        results.fb_hz = box.fb_hz;
    }

    const empty = (): Simulation => ({
        frequencies_hz: FREQUENCIES_HZ,
        curves: {},
        spl_normalized: true,
        missing,
        results,
        warnings,
    });

    if (responseMissing.length > 0 || box.vb_m3 === undefined) {
        return empty();
    }

    const driversVolume = count * (values.vd_m3 ?? 0);
    const portCount = Math.max(1, Math.round(box.port.count));
    const area = vented ? portArea(box.port) : undefined;
    let netVolume = box.vb_m3 - driversVolume;

    if (netVolume <= 0) {
        results.net_volume_m3 = netVolume;
        warnings.push({ id: 'netVolumeInvalid' });

        return empty();
    }

    // Na dutada, o volume dos dutos também sai da caixa (research.md §7).
    if (area !== undefined && box.fb_hz !== undefined) {
        const solved = solveNetVolume({
            vb_m3: box.vb_m3,
            drivers_m3: driversVolume,
            fb_hz: box.fb_hz,
            area_m2: area,
            count: portCount,
        });

        if (Number.isNaN(solved.length_m)) {
            results.net_volume_m3 = solved.net_m3;
            warnings.push({ id: 'portVolumeTooLarge' });

            return empty();
        }

        netVolume = solved.net_m3;
        results.port_length_m = solved.length_m;

        if (solved.length_m <= 0) {
            warnings.push({ id: 'portTooShort' });
        } else if (solved.length_m > Math.cbrt(box.vb_m3)) {
            // Duto mais longo que a maior medida de uma caixa cúbica: ressonâncias do tubo
            // caem perto da banda e ele dificilmente cabe.
            warnings.push({
                id: 'portTooLong',
                values: { length_m: solved.length_m },
            });
        }
    }

    results.net_volume_m3 = netVolume;

    const fs = values.fs_hz as number;
    const qts = values.qts as number;
    const vas = values.vas_m3 as number;
    const omegaS = 2 * Math.PI * fs;

    // Cada driver vê a sua fração da caixa (research.md §5).
    const boxPerDriver = netVolume / count;
    const alpha = vas / boxPerDriver;
    const cab = boxPerDriver / RHO_C2;

    if (!vented) {
        // [S73c] eq. 9–10.
        results.qtc = qts * Math.sqrt(1 + alpha);
        results.fc_hz = fs * Math.sqrt(1 + alpha);
    }

    // Perdas por vazamento: QL = ω·Ral·Cab na frequência de referência da caixa ([S73v] eq. 7).
    const referenceOmega =
        2 *
        Math.PI *
        (vented ? (box.fb_hz as number) : (results.fc_hz as number));
    const ral = box.ql / (referenceOmega * cab);
    // Massa do duto pela sintonia: Fb = 1 / (2π·√(Map·Cab)).
    const map = vented
        ? 1 / ((2 * Math.PI * (box.fb_hz as number)) ** 2 * cab)
        : undefined;

    // A forma da resposta depende só de Fs, Qts e Vas; Re, Sd e Qms dão a escala absoluta.
    const absolute = absoluteMissing.length === 0;
    const sd = absolute ? (values.sd_m2 as number) : NORMALIZED_SD;
    const re = absolute ? (values.re_ohm as number) : 1;
    const qms = absolute ? (values.qms as number) : Number.POSITIVE_INFINITY;
    const qes = Number.isFinite(qms) ? (qts * qms) / (qms - qts) : qts;
    const cms = vas / (RHO_C2 * sd ** 2);
    const mms = 1 / (omegaS ** 2 * cms);
    const perDriver: CircuitParams = {
        re,
        le: absolute ? (values.le_h ?? 0) : 0,
        bl: Math.sqrt((omegaS * mms * re) / qes),
        mms,
        cms,
        rms: Number.isFinite(qms) ? (omegaS * mms) / qms : 0,
        sd,
        cab,
        ral,
        map,
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
        lowFrequency: { ...perDriver, le: 0 },
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
        results.port_velocity_max_ms = Math.max(...portVelocity);
    }

    const f3 = findF3(model);
    results.f3_hz = f3.f3;
    results.f3_below_range = f3.below || undefined;

    // Potência que leva o cone ao Xmax: x ∝ V, então P·(Xmax/x)², a menor entre F3 e 1000 Hz
    // (research.md §7); abaixo de F3 a caixa já não é usada.
    if (
        curves.excursion_m !== undefined &&
        values.xmax_m !== undefined &&
        values.xmax_m > 0 &&
        results.power_w !== undefined
    ) {
        const from = f3.f3 ?? FREQUENCIES_HZ[0];
        const xmax = values.xmax_m;
        const power = results.power_w;
        results.xmax_power_w = Math.min(
            ...FREQUENCIES_HZ.flatMap((frequency, index) =>
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
