import type { BotModuleBundle } from '../shared/types/bot-module.js';
import { createKothModule, type KothModuleContext } from './koth/koth.module.js';

/**
 * Registro de módulos del bot. Para añadir una nueva funcionalidad (otro tipo de
 * evento, anuncios, administración...), crea su carpeta en `modules/` y
 * regístrala aquí. Cada módulo aporta su ciclo de vida y sus comandos slash.
 */
export function createModules(context: KothModuleContext): BotModuleBundle[] {
  return [createKothModule({ ...context, logger: context.logger.child({ module: 'koth' }) })];
}
