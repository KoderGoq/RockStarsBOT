import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import {
  REST,
  type RESTGetAPIApplicationEmojisResult,
  type RESTPostAPIApplicationEmojiJSONBody,
  Routes,
} from 'discord.js';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { colorizeSvg } from '../shared/icons/colorize-svg.js';
import {
  ICON_CATALOG,
  ICON_NAMES,
  type IconName,
  toEmojiName,
} from '../shared/icons/icon-catalog.js';

/** Discord recomienda emojis de 128x128. */
const EMOJI_SIZE_PX = 128;

/**
 * Sincroniza los iconos de Lucide del catálogo como emojis de la aplicación.
 *
 *   pnpm icons:sync            sube solo los iconos que faltan (idempotente)
 *   pnpm icons:sync --force    vuelve a crear todos (p. ej. tras cambiar un color)
 *
 * Solo necesita DISCORD_TOKEN y DISCORD_CLIENT_ID; no abre conexión con el gateway.
 */
async function syncIcons(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const force = process.argv.includes('--force');
  const rest = new REST().setToken(env.DISCORD_TOKEN);

  const existing = await listApplicationEmojis(rest, env.DISCORD_CLIENT_ID);
  const created: IconName[] = [];
  const skipped: IconName[] = [];

  for (const icon of ICON_NAMES) {
    const emojiName = toEmojiName(icon);
    const current = existing.get(emojiName);

    if (current !== undefined && !force) {
      skipped.push(icon);
      continue;
    }
    if (current !== undefined) {
      await rest.delete(Routes.applicationEmoji(env.DISCORD_CLIENT_ID, current));
    }

    const body: RESTPostAPIApplicationEmojiJSONBody = {
      name: emojiName,
      image: `data:image/png;base64,${(await renderIconPng(icon)).toString('base64')}`,
    };
    await rest.post(Routes.applicationEmojis(env.DISCORD_CLIENT_ID), { body });
    created.push(icon);
    logger.info({ icon, emoji: emojiName }, 'Icono subido');
  }

  logger.info(
    { created: created.length, unchanged: skipped.length },
    'Iconos sincronizados. Reinicia el bot para que los use.',
  );
}

/** Devuelve `nombre del emoji → id` de los emojis actuales de la aplicación. */
async function listApplicationEmojis(
  rest: REST,
  applicationId: string,
): Promise<Map<string, string>> {
  const result = (await rest.get(
    Routes.applicationEmojis(applicationId),
  )) as RESTGetAPIApplicationEmojisResult;

  const emojis = new Map<string, string>();
  for (const emoji of result.items) {
    emojis.set(emoji.name, emoji.id);
  }
  return emojis;
}

async function renderIconPng(icon: IconName): Promise<Buffer> {
  const svg = await readFile(join(resolveLucideIconsDirectory(), `${icon}.svg`), 'utf8');
  const colored = colorizeSvg(svg, ICON_CATALOG[icon].color);

  return new Resvg(colored, { fitTo: { mode: 'width', value: EMOJI_SIZE_PX } }).render().asPng();
}

function resolveLucideIconsDirectory(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('lucide-static/package.json')), 'icons');
}

syncIcons().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`No se pudieron sincronizar los iconos:\n${message}\n`);
  process.exit(1);
});
