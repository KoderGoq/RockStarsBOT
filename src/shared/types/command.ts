import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandSubcommandBuilder,
} from 'discord.js';

/** Comando slash de primer nivel (p. ej. `/koth`). */
export interface SlashCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

/** Subcomando de un comando slash (p. ej. `/koth siguiente`). */
export interface SlashSubcommand {
  readonly name: string;
  readonly description: string;
  /** Permite declarar opciones del subcomando (p. ej. un entero con opciones fijas). */
  readonly configure?: (builder: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
