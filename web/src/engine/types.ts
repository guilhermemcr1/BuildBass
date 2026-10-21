// Entradas e saídas do motor, sempre em SI (data-model.md). O motor não depende de nada da
// interface; `lib/project/types.ts` reexporta estes tipos para o resto do app.

export type DriverKey =
    | 'fs_hz'
    | 'qts'
    | 'qes'
    | 'qms'
    | 'vas_m3'
    | 're_ohm'
    | 'le_h'
    | 'xmax_m'
    | 'sd_m2'
    | 'pe_w'
    | 'bl_tm'
    | 'mms_kg'
    | 'vd_m3';

// Só os valores digitados; os derivados são recalculados pelo motor.
export type DriverInput = Partial<Record<DriverKey, number>>;

export type Wiring = 'series' | 'parallel';

export type DriversInput = { count: number; wiring: Wiring };

export type PortShape = 'round' | 'rect' | 'triangle';

export type PortInput =
    | { shape: 'round'; diameter_m?: number; count: number }
    | { shape: 'rect'; width_m?: number; height_m?: number; count: number }
    | { shape: 'triangle'; base_m?: number; height_m?: number; count: number };

export type BoxType = 'closed' | 'vented' | 'bandpass';

export type BoxInput = {
    type: BoxType;
    // Selada e dutada: volume bruto da caixa.
    vb_m3?: number;
    // Bandpass: volume bruto da câmara traseira (selada) e da frontal (dutada).
    vr_m3?: number;
    vf_m3?: number;
    ql: number;
    // Dutada: sintonia da caixa. Bandpass: sintonia da câmara frontal.
    fb_hz?: number;
    // Dutada: duto da caixa. Bandpass: duto da câmara frontal.
    port: PortInput;
};

export type Radiation = 'half' | 'full';

export type SignalInput = {
    mode: 'power' | 'voltage';
    power_w?: number;
    voltage_v?: number;
    radiation: Radiation;
};

export type ProjectInput = {
    name: string;
    driver: DriverInput;
    drivers: DriversInput;
    box: BoxInput;
    signal: SignalInput;
};

export type ParameterSource = 'typed' | 'derived';

export type RelationId = 'qts' | 'fs' | 'vas' | 'qes';

export type ConsistencyStatus =
    | 'none'
    | 'ok'
    | 'warn'
    | 'error'
    | 'unchecked'
    | 'derived';

export type Consistency = {
    status: ConsistencyStatus;
    relation?: RelationId;
    deviation?: number;
};

export type DerivedValue = { value?: number; source: ParameterSource };

export type DerivedDriver = {
    values: Record<DriverKey, DerivedValue>;
    // Compliância mecânica, só derivada (não é campo da bancada).
    cms_mn?: number;
    consistency: Record<DriverKey, Consistency>;
};

// Campos que podem faltar para um gráfico (nomes iguais aos campos da bancada).
export type FieldKey =
    | DriverKey
    | 'vb_m3'
    | 'vr_m3'
    | 'vf_m3'
    | 'fb_hz'
    | 'diameter_m'
    | 'width_m'
    | 'height_m'
    | 'base_m'
    | 'power_w'
    | 'voltage_v';

export type CurveId =
    | 'spl_db'
    | 'excursion_m'
    | 'impedance_ohm'
    | 'group_delay_s'
    | 'port_velocity_ms';

export type WarningId =
    | 'netVolumeInvalid'
    | 'rearVolumeInvalid'
    | 'portTooShort'
    | 'portTooLong'
    | 'portVolumeTooLarge'
    | 'aboveThermalPower'
    | 'noInductance';

export type EngineWarning = { id: WarningId; values?: Record<string, number> };

export type SimulationResults = {
    f3_hz?: number;
    // F3 abaixo da grade (10 Hz).
    f3_below_range?: boolean;
    qtc?: number;
    fc_hz?: number;
    // Bandpass: cortes de −3 dB em relação ao pico, frequência central, largura e pico.
    f_low_hz?: number;
    f_high_hz?: number;
    f_center_hz?: number;
    bandwidth_oct?: number;
    peak_db?: number;
    // Corte inferior abaixo da grade (10 Hz) / superior acima dela (1000 Hz).
    f_low_below_range?: boolean;
    f_high_above_range?: boolean;
    fb_hz?: number;
    net_volume_m3?: number;
    // Bandpass: volumes líquidos das duas câmaras.
    net_rear_m3?: number;
    net_front_m3?: number;
    port_length_m?: number;
    port_velocity_max_ms?: number;
    xmax_power_w?: number;
    efficiency?: number;
    spl0_db?: number;
    voltage_v?: number;
    power_w?: number;
    impedance_total_ohm?: number;
};

export type Simulation = {
    frequencies_hz: readonly number[];
    curves: Partial<Record<CurveId, number[]>>;
    // true quando faltam dados para o nível absoluto: a resposta sai relativa à banda de passagem.
    spl_normalized: boolean;
    missing: Record<CurveId, FieldKey[]>;
    results: SimulationResults;
    warnings: EngineWarning[];
};
