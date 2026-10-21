// API pública do motor (contracts/engine.md). A interface só calcula física por aqui.
export { PORT_VELOCITY_ERROR_MS, PORT_VELOCITY_WARN_MS } from './constants';
export { deriveDriver, DRIVER_KEYS } from './driver';
export { FREQUENCIES_HZ } from './frequencies';
export { suggestBox } from './alignments';
export type { Alignment, Suggestion } from './alignments';
export { portArea } from './port';
export { signalLevels, simulate } from './simulate';
export type { SignalLevels } from './simulate';
export type * from './types';
