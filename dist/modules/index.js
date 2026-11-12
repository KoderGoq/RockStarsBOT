import { createKothCommands, createKothModule, } from './koth/koth.module.js';
/**
 * Registro de módulos del bot. Para añadir una nueva funcionalidad (otro tipo de
 * evento, anuncios, administración...), crea su carpeta en `modules/` y
 * regístrala aquí.
 */
export function createCommands(context) {
    return [...createKothCommands(context)];
}
export function createModules(context) {
    return [createKothModule({ ...context, logger: context.logger.child({ module: 'koth' }) })];
}
//# sourceMappingURL=index.js.map