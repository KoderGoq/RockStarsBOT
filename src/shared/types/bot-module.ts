/**
 * Módulo funcional del bot (KOTH, futuros eventos, anuncios...).
 * Cada módulo gestiona su propio ciclo de vida y se arranca cuando el cliente
 * de Discord está listo.
 */
export interface BotModule {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
