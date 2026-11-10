import type { KothReminder } from './koth.types.js';

export interface AnnouncementResult {
  readonly messageId: string;
}

/**
 * Puerto de salida para publicar avisos.
 * El scheduler depende de esta interfaz, no de Discord.
 */
export interface KothAnnouncer {
  announce(reminder: KothReminder): Promise<AnnouncementResult>;
}
