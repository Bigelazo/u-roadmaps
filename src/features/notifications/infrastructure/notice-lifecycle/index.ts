// ADR-0024: the notice lifecycle module — (A) record, (B) deliver, (C) capture and recognize.
export { recordNoticeTargets, type NoticeDelivery } from './record';
export {
  targetOpeningSnapshots,
  recognizeTargetSnapshots,
  recognizeKnownValue,
  lazyRoadmapEnvelope,
} from './recognize';
export type { NodeAccessReader } from './roadmap-view';
