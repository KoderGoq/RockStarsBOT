import type { ButtonHandler } from './button.js';
import type { SlashCommand } from './command.js';

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

/** Un módulo junto con los comandos slash y los botones que aporta. */
export interface BotModuleBundle {
  readonly module: BotModule;
  readonly commands: readonly SlashCommand[];
  readonly buttons: readonly ButtonHandler[];
}
