/** ID 생성 — 시간순 정렬 가능 + 충돌 회피용 랜덤 꼬리. */
import { randomBytes } from 'node:crypto';

export type IdPrefix = 'sess' | 'blk';

export function createId(prefix: IdPrefix, now: Date = new Date()): string {
  const time = now.getTime().toString(36);
  const rand = randomBytes(4).toString('hex');
  return `${prefix}_${time}${rand}`;
}
