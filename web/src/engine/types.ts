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

export type BoxType = 'closed' | 'vented';

export type BoxInput = {
    type: BoxType;
    vb_m3?: number;
    ql: number;
    fb_hz?: number;
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
