import { createHmac } from 'node:crypto';

export function createSubscriberHash(subscriberId: string, secretKey: string) {
  return createHmac('sha256', secretKey).update(subscriberId).digest('hex');
}
