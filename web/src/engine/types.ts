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

// 'bandpass' é a de 4ª ordem (traseira selada + frontal dutada, specs/004); 'bandpass6' a de 6ª
// ordem (as duas câmaras dutadas, specs/007).
export type BoxType = 'closed' | 'vented' | 'bandpass' | 'bandpass6';

// Tipos com duas câmaras separadas pelo driver (volumes vr/vf, divisória no plano de corte).
export function twoChambers(type: BoxType): boolean {
    return type === 'bandpass' || type === 'bandpass6';
}

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
    // Bandpass de 6ª ordem: sintonia da câmara traseira (mesma faixa de `fb_hz`).
    fb_rear_hz?: number;
    // Dutada: duto da caixa. Bandpass: duto da câmara frontal.
    port: PortInput;
    // Bandpass de 6ª ordem: duto da câmara traseira. Ausente = redondo, 1 duto, sem medida.
    port_rear?: PortInput;
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
    | 'fb_rear_hz'
    | 'diameter_m'
    | 'width_m'
    | 'height_m'
    | 'base_m'
    | 'rear_diameter_m'
    | 'rear_width_m'
    | 'rear_height_m'
    | 'rear_base_m'
    | 'power_w'
    | 'voltage_v';

export type CurveId =
    | 'spl_db'
    | 'excursion_m'
    | 'impedance_ohm'
    | 'group_delay_s'
    | 'port_velocity_ms'
    // Bandpass de 6ª ordem: velocidade do ar no duto traseiro (a do frontal é `port_velocity_ms`).
    | 'port_rear_velocity_ms';

export type WarningId =
    | 'netVolumeInvalid'
    | 'rearVolumeInvalid'
    | 'portTooShort'
    | 'portTooLong'
    | 'portVolumeTooLarge'
    | 'aboveThermalPower'
    | 'noInductance';

// `chamber` diz de qual câmara/duto é o aviso na bandpass de 6ª ordem; nos outros tipos fica ausente.
export type EngineWarning = {
    id: WarningId;
    chamber?: 'rear' | 'front';
    values?: Record<string, number>;
};

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
    // Bandpass de 6ª ordem: sintonia, comprimento e velocidade máxima do duto da câmara traseira
    // (`fb_hz`, `port_length_m` e `port_velocity_max_ms` são os do duto frontal).
    fb_rear_hz?: number;
    port_rear_length_m?: number;
    port_rear_velocity_max_ms?: number;
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
