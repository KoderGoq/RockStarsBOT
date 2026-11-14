import type { DateTime } from 'luxon';

export interface KothPanelMessageRecord {
  readonly key: string;
  readonly channelId: string;
  readonly messageId: string;
}

/** Recuerda qué mensaje es el panel, para poder actualizarlo después. */
export interface KothPanelMessageRepository {
  find(key: string): KothPanelMessageRecord | undefined;

  /** Guarda (o sustituye) el mensaje asociado a una clave. */
  save(key: string, channelId: string, messageId: string, now: DateTime): void;
}
