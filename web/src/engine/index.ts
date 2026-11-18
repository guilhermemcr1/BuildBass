// API pública do motor. A interface só calcula física por aqui.
export { PORT_VELOCITY_ERROR_MS, PORT_VELOCITY_WARN_MS } from './constants';
export { deriveDriver, DRIVER_KEYS } from './driver';
export {
    ANALYSIS_FREQUENCIES_HZ,
    ANALYSIS_MAX_HZ,
    CHART_MAX_HZ,
    FREQUENCIES_HZ,
} from './frequencies';
export { suggestBox } from './alignments';
export type { Alignment, Suggestion } from './alignments';
export { portArea } from './port';
export {
    ABSOLUTE_NEEDS,
    RESPONSE_NEEDS,
    requiredBoxFields,
    signalLevels,
    simulate,
    tunedByLength,
} from './simulate';
export type { SignalLevels } from './simulate';
export { twoChambers } from './types';
export type * from './types';
