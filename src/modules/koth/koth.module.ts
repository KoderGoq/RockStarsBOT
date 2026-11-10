import type { DatabaseSync } from 'node:sqlite';
import type { Client } from 'discord.js';
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import { kothConfig } from '../../config/koth.config.js';
import type { IconResolver } from '../../shared/icons/icon-registry.js';
import type { BotModule } from '../../shared/types/bot-module.js';
import type { Clock } from '../../shared/types/clock.js';
import type { SlashCommand } from '../../shared/types/command.js';
import { PollingTask } from '../../shared/utils/polling-task.js';
import { createKothCommand } from './commands/koth.command.js';
import { SqliteKothNotificationRepository } from './repositories/sqlite-koth-notification.repository.js';
import { DiscordKothAnnouncer } from './services/koth-notification.service.js';
import { KothSchedulerService } from './services/koth-scheduler.service.js';
import { KothTimeService } from './services/koth-time.service.js';
import type { MessageContext } from './templates/koth-messages.js';

export interface KothCommandsContext {
  readonly env: Env;
  readonly clock: Clock;
  readonly icons: IconResolver;
}

export interface KothModuleContext extends KothCommandsContext {
  readonly client: Client;
  readonly database: DatabaseSync;
  readonly logger: Logger;
}

export function createKothTimeService(timezone: string): KothTimeService {
  return new KothTimeService({
    timezone,
    slots: kothConfig.slots,
    reminderOffsetsMinutes: kothConfig.reminderOffsetsMinutes,
  });
}

/** Comandos slash del módulo. No requieren conexión a Discord ni base de datos. */
export function createKothCommands({ env, clock, icons }: KothCommandsContext): SlashCommand[] {
  return [
    createKothCommand({
      timeService: createKothTimeService(env.TIMEZONE),
      clock,
      messageContext: toMessageContext(env, icons),
      announcementChannelId: env.DISCORD_CHANNEL_ID,
    }),
  ];
}

/** Composición del módulo KOTH: scheduler, persistencia y publicación en Discord. */
export function createKothModule(context: KothModuleContext): BotModule {
  const { env, clock, logger, icons } = context;
  const timeService = createKothTimeService(env.TIMEZONE);
  const repository = new SqliteKothNotificationRepository(context.database);
  const announcer = new DiscordKothAnnouncer({
    client: context.client,
    channelId: env.DISCORD_CHANNEL_ID,
    messageContext: toMessageContext(env, icons),
  });
  const scheduler = new KothSchedulerService({
    timeService,
    repository,
    announcer,
    logger,
    options: { maxLatenessMs: kothConfig.scheduler.maxLatenessMs },
  });
  const polling = new PollingTask({
    name: 'koth-scheduler',
    intervalMs: kothConfig.scheduler.pollIntervalMs,
    logger,
    task: async () => {
      await scheduler.tick(clock.now());
    },
  });

  return {
    name: 'koth',

    async start() {
      await announcer.verifyChannel();

      const now = clock.now();
      const cutoff = now.minus({ days: kothConfig.scheduler.historyRetentionDays });
      const pruned = repository.deleteEventsBefore(cutoff);
      logger.info({ pruned }, 'Historial antiguo de avisos depurado');

      polling.start();

      const next = timeService.getNextOccurrence(now);
      logger.info(
        { koth: next.slot.name, startsAt: next.startsAt.toISO() },
        'Scheduler de KOTH en marcha',
      );
    },

    async stop() {
      await polling.stop();
    },
  };
}

function toMessageContext(env: Env, icons: IconResolver): MessageContext {
  return {
    serverIp: env.SERVER_IP,
    timezone: env.TIMEZONE,
    mentionEveryone: kothConfig.mentionEveryone,
    icons,
  };
}
