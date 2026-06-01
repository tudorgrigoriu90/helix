export { parseLaceLines } from './lace-loader';
export type { LaceLoaderResult } from './lace-loader';

export { selectLine } from './lace-select';
export type { SelectParams } from './lace-select';

export {
  LaceMoodMachine,
  MOOD_THRESHOLD,
  MOOD_DRIFT_RETENTION,
  RESTING_MOOD,
  ZERO_MOOD_PRESSURE,
  driftPressure,
} from './lace-mood';
export type { BehaviourMood, MoodPressure, MoodSignal } from './lace-mood';

export { assembleLine } from './lace-grammar';
export type { GrammarRequest, LaceGrammar } from './lace-grammar';

export { LaceNarrator } from './narrator';
export type { NarrateContextDetail } from './narrator';
