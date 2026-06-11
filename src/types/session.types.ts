/**
 * 세션 타입 — PRD §10.1, §10.4.
 * 세션은 하나의 활성 작업 컨텍스트를 나타낸다.
 */
import type { WorkContext } from './context.types.js';

/** 세션 정체성 라벨 — 장식이 아니라 작업 모드 구분용 (PRD §10.4) */
export type Motif =
  | 'campsite'
  | 'workshop'
  | 'courtroom'
  | 'mission_control'
  | 'lab';

export interface Session extends WorkContext {
  readonly session_id: string;
  /** ISO 8601 (타임존 포함) */
  readonly started_at: string;
  readonly motif: Motif;
}

export const MOTIF_LABELS: Readonly<Record<Motif, string>> = {
  campsite: '🏕️ Campsite',
  workshop: '🔧 Workshop',
  courtroom: '⚖️ Courtroom',
  mission_control: '🛰️ Mission Control',
  lab: '🧪 Lab',
};
