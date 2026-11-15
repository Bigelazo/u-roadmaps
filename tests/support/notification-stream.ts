import {
  NOTIFICATION_STREAM_LIFETIME_MS,
  NOTIFICATION_STREAM_ROTATION_LEAD_MS,
} from '@/features/notifications/contracts/notification-stream';

const READY_LATENCY_MS = 50;
const BROWSER_RETRY_MS = 3000;

export class SimulatedNotificationStream extends EventTarget {
  static instances: SimulatedNotificationStream[] = [];
  static userId = 'teacher';
  readyState = 0;
  closed = false;
  private session = 0;

  constructor(readonly url: string) {
    super();
    SimulatedNotificationStream.instances.push(this);
    this.connect();
  }

  static open() {
    return SimulatedNotificationStream.instances.filter(
      (stream) => !stream.closed && stream.readyState === 1,
    );
  }

  static broadcast(kind: string, data: object) {
    for (const stream of SimulatedNotificationStream.open()) stream.emit(kind, data);
  }

  static reset() {
    for (const stream of SimulatedNotificationStream.instances) stream.close();
    SimulatedNotificationStream.instances = [];
  }

  close() {
    this.closed = true;
    this.readyState = 2;
    this.session += 1;
  }

  emit(kind: string, data: object) {
    if (this.closed || this.readyState !== 1) return;
    this.dispatchEvent(new MessageEvent(kind, { data: JSON.stringify(data) }));
  }

  fail() {
    if (this.closed) return;
    this.session += 1;
    this.readyState = 2;
    this.dispatchEvent(new Event('error'));
  }

  private connect() {
    const session = ++this.session;
    this.readyState = 0;
    setTimeout(() => {
      if (session !== this.session || this.closed) return;
      this.readyState = 1;
      this.emit('ready', { userId: SimulatedNotificationStream.userId });
      setTimeout(() => {
        if (session === this.session) {
          this.emit('rotate', { userId: SimulatedNotificationStream.userId });
        }
      }, NOTIFICATION_STREAM_LIFETIME_MS - NOTIFICATION_STREAM_ROTATION_LEAD_MS);
      setTimeout(() => this.end(session), NOTIFICATION_STREAM_LIFETIME_MS);
    }, READY_LATENCY_MS);
  }

  private end(session: number) {
    if (session !== this.session || this.closed) return;
    this.readyState = 0;
    this.dispatchEvent(new Event('error'));
    const reconnecting = ++this.session;
    setTimeout(() => {
      if (reconnecting === this.session && !this.closed) this.connect();
    }, BROWSER_RETRY_MS);
  }
}
