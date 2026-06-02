export {
  CURRENT_RUN_SCHEMA_VERSION,
  serializeRunState,
  deserializeRunState,
  migrate,
  RUN_MIGRATIONS,
} from './run-save';
export type { RunLoadResult, SaveError, SaveErrorCode, Migration } from './run-save';

export {
  newMetaState,
  serializeMetaState,
  deserializeMetaState,
  metaCodec,
  META_MIGRATIONS,
} from './meta-save';
export type { MetaLoadResult } from './meta-save';

export { SaveManager } from './save-manager';
export type { SaveCodec, LoadResult } from './save-manager';

export {
  recordRunOutcome,
  shouldShowTutorial,
  markTutorialComplete,
  completeTutorial,
  FIRST_CONVERGENCE_ACHIEVEMENT_ID,
} from './meta-progression';
export type { RunOutcome } from './meta-progression';
