// ADR-0024: the notice lifecycle module — (A) record, (B) deliver, (C) capture and recognize.
export { recordNoticeTargets, type NoticeDelivery } from './record';
export { recognizeTargetSnapshots } from './recognize';
export { entryTargetSnapshots } from './entry';
export type { NodeAccessReader } from './roadmap-view';
