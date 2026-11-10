import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { Logger } from 'pino';
import type { IconResolver } from '../../shared/icons/icon-registry.js';
import type { SlashCommand } from '../../shared/types/command.js';

const COMMAND_ERROR_TEXT =
  'Ha ocurrido un error al ejecutar el comando. Inténtalo de nuevo en unos instantes.';

/** Registro y despacho de comandos slash con manejo centralizado de errores. */
export class CommandRegistry {
  private readonly commands = new Map<string, SlashCommand>();

  constructor(
    commands: readonly SlashCommand[],
    private readonly icons: IconResolver,
    private readonly logger: Logger,
  ) {
    for (const command of commands) {
      if (this.commands.has(command.data.name)) {
        throw new Error(`Comando duplicado: /${command.data.name}`);
      }
      this.commands.set(command.data.name, command);
    }
  }

  /** Nunca lanza: los errores se registran y se informa al usuario. */
  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (command === undefined) {
      this.logger.warn({ command: interaction.commandName }, 'Comando no registrado');
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, command: interaction.commandName, user: interaction.user.id },
        'Error al ejecutar comando',
      );
      await this.replyWithError(interaction);
    }
  }

  private async replyWithError(interaction: ChatInputCommandInteraction): Promise<void> {
    const payload = {
      content: `${this.icons.get('circle-x')} ${COMMAND_ERROR_TEXT}`,
      flags: MessageFlags.Ephemeral,
    } as const;
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (error: unknown) {
      this.logger.error({ err: error }, 'No se pudo notificar el error al usuario');
    }
  }
}
