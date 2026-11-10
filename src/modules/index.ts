import type { BotModule } from '../shared/types/bot-module.js';
import type { SlashCommand } from '../shared/types/command.js';
import {
  createKothCommands,
  createKothModule,
  type KothCommandsContext,
  type KothModuleContext,
} from './koth/koth.module.js';

/**
 * Registro de módulos del bot. Para añadir una nueva funcionalidad (otro tipo de
 * evento, anuncios, administración...), crea su carpeta en `modules/` y
 * regístrala aquí.
 */
export function createCommands(context: KothCommandsContext): SlashCommand[] {
  return [...createKothCommands(context)];
}

export function createModules(context: KothModuleContext): BotModule[] {
  return [createKothModule({ ...context, logger: context.logger.child({ module: 'koth' }) })];
}
