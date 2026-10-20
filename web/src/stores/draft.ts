import { create } from 'zustand';
import type { ParameterKey } from '@/lib/parameters';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from './preferences';

export type BoxType = 'closed' | 'vented';

// Rascunho da bancada, só em memória. `values` guarda SEMPRE valores SI (constituição, III);
// a unidade escolhida em cada campo muda apenas a exibição.
type DraftState = {
    values: Partial<Record<ParameterKey, number>>;
    fieldUnits: Partial<Record<ParameterKey, UnitId>>;
    boxType: BoxType;
    setValue: (key: ParameterKey, si: number) => void;
    setFieldUnit: (key: ParameterKey, unit: UnitId) => void;
    clearFieldUnits: () => void;
    setBoxType: (boxType: BoxType) => void;
    reset: () => void;
};

const INITIAL = {
    values: {},
    fieldUnits: {},
    boxType: 'vented' as BoxType,
};

export const useDraft = create<DraftState>()((set) => ({
    ...INITIAL,
    setValue: (key, si) =>
        set((state) => ({ values: { ...state.values, [key]: si } })),
    setFieldUnit: (key, unit) =>
        set((state) => ({ fieldUnits: { ...state.fieldUnits, [key]: unit } })),
    clearFieldUnits: () => set({ fieldUnits: {} }),
    setBoxType: (boxType) => set({ boxType }),
    reset: () => set(INITIAL),
}));

// Trocar o sistema global (métrico/imperial) devolve todos os campos à unidade padrão do novo
// sistema; os valores SI não mudam (data-model.md, transições do Draft).
usePreferences.subscribe((state, previous) => {
    if (state.unitSystem !== previous.unitSystem) {
        useDraft.getState().clearFieldUnits();
    }
});
