export const KOTH_COMMAND_NAME = 'koth';

/** Identificadores de los botones del panel de suscripción. */
export const KOTH_SUBSCRIBE_BUTTON_ID = 'koth:subscribe';
export const KOTH_UNSUBSCRIBE_BUTTON_ID = 'koth:unsubscribe';

/** Clave con la que se recuerda el mensaje del panel de suscripción. */
export const SUBSCRIPTION_PANEL_KEY = 'koth-subscription-panel';

/** Los siete días de la semana, de lunes (1) a domingo (7). */
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

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

/** Estado del MD de un aviso para un suscriptor concreto. */
export const DeliveryStatus = {
  /** Reservado; el envío está en curso (o el proceso cayó a mitad). */
  Processing: 'processing',
  Sent: 'sent',
  /** Tiene los MD cerrados o bloqueó al bot. */
  Unreachable: 'unreachable',
  /** Ya no está en el servidor. */
  Left: 'left',
  /** Error inesperado; no se reintenta. */
  Failed: 'failed',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

/** Estados finales sin entrega, los únicos que se pueden registrar tras un fallo. */
export type UndeliveredStatus =
  typeof DeliveryStatus.Unreachable | typeof DeliveryStatus.Left | typeof DeliveryStatus.Failed;

export const KOTH_EMBED_COLORS = {
  info: 0x5865f2,
  reminder60: 0xf1c40f,
  reminder30: 0xe67e22,
  reminder10: 0xe74c3c,
} as const;
