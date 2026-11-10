export const KOTH_COMMAND_NAME = 'koth';

/** Estado de un aviso registrado en la persistencia. */
export const NotificationStatus = {
  /** Reservado por un proceso; el envío está en curso (o el proceso cayó a mitad). */
  Processing: 'processing',
  Sent: 'sent',
  Skipped: 'skipped',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/** Motivo por el que un aviso no se publicó. */
export const SkipReason = {
  /** Existe un aviso posterior del mismo KOTH que ya es exigible. */
  Superseded: 'superseded',
  /** El aviso se detectó con más retraso del tolerado (p. ej. el bot estaba caído). */
  TooLate: 'too-late',
} as const;
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason];

export const KOTH_EMBED_COLORS = {
  info: 0x5865f2,
  reminder60: 0xf1c40f,
  reminder30: 0xe67e22,
  reminder10: 0xe74c3c,
} as const;
