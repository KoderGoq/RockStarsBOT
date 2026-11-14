import type { DatabaseSync } from 'node:sqlite';
import type { Client } from 'discord.js';
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import { kothConfig } from '../../config/koth.config.js';
import type { IconResolver } from '../../shared/icons/icon-registry.js';
import type { BotModuleBundle } from '../../shared/types/bot-module.js';
import type { Clock } from '../../shared/types/clock.js';
import { PollingTask } from '../../shared/utils/polling-task.js';
import { sleep } from '../../shared/utils/sleep.js';
import { createKothSubscriptionButtons } from './buttons/koth-subscription.buttons.js';
import type { KothCommandDependencies } from './commands/koth-command.dependencies.js';
import { createKothCommand } from './commands/koth.command.js';
import { SqliteKothDmDeliveryRepository } from './repositories/sqlite-koth-dm-delivery.repository.js';
import { SqliteKothNotificationRepository } from './repositories/sqlite-koth-notification.repository.js';
import { SqliteKothPanelMessageRepository } from './repositories/sqlite-koth-panel-message.repository.js';
import { SqliteKothSubscriberRepository } from './repositories/sqlite-koth-subscriber.repository.js';
import { KothDmDispatcherService } from './services/koth-dm-dispatcher.service.js';
import { DiscordKothDirectMessenger } from './services/koth-direct-message.service.js';
import { DiscordKothAnnouncer } from './services/koth-notification.service.js';
import { DiscordKothSubscriptionPanelGateway } from './services/koth-panel-message.service.js';
import { KothSchedulerService } from './services/koth-scheduler.service.js';
import { KothSubscriptionPanelService } from './services/koth-subscription-panel.service.js';
import { KothSubscriptionService } from './services/koth-subscription.service.js';
import { KothTimeService } from './services/koth-time.service.js';
import type { MessageContext } from './templates/koth-messages.js';

export interface KothModuleContext {
  readonly env: Env;
  readonly clock: Clock;
  readonly icons: IconResolver;
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

/**
 * Composición del módulo KOTH: avisos del canal, MD a suscriptores, persistencia y
 * comandos. Construir el módulo no abre ninguna conexión: el cliente de Discord solo
 * se usa cuando se ejecuta un comando o se arranca el módulo.
 */
export function createKothModule(context: KothModuleContext): BotModuleBundle {
  const { env, clock, logger, icons, client, database } = context;
  const messageContext = toMessageContext(env, icons);
  const timeService = createKothTimeService(env.TIMEZONE);

  const notificationRepository = new SqliteKothNotificationRepository(database);
  const subscriberRepository = new SqliteKothSubscriberRepository(database);
  const deliveryRepository = new SqliteKothDmDeliveryRepository(database);

  const announcer = new DiscordKothAnnouncer({
    client,
    channelId: env.DISCORD_CHANNEL_ID,
    messageContext,
  });
  const messenger = new DiscordKothDirectMessenger({
    client,
    guildId: env.DISCORD_GUILD_ID,
    messageContext,
  });
  const subscriptions = new KothSubscriptionService({
    subscribers: subscriberRepository,
    messenger,
    clock,
  });

  // El panel con botones solo existe si hay un canal de suscripción configurado.
  const subscriptionChannelId = env.DISCORD_SUBSCRIPTION_CHANNEL_ID;
  const panelGateway = new DiscordKothSubscriptionPanelGateway({ client, messageContext });
  const panel =
    subscriptionChannelId === undefined
      ? null
      : new KothSubscriptionPanelService({
          channelId: subscriptionChannelId,
          panels: new SqliteKothPanelMessageRepository(database),
          gateway: panelGateway,
          clock,
        });

  const commandDependencies: KothCommandDependencies = {
    timeService,
    clock,
    messageContext,
    announcementChannelId: env.DISCORD_CHANNEL_ID,
    subscriptions,
    messenger,
    panel,
  };

  const scheduler = new KothSchedulerService({
    timeService,
    repository: notificationRepository,
    announcer,
    logger,
    options: { maxLatenessMs: kothConfig.scheduler.maxLatenessMs },
  });
  const dmDispatcher = new KothDmDispatcherService({
    timeService,
    subscribers: subscriberRepository,
    deliveries: deliveryRepository,
    messenger,
    clock,
    pause: sleep,
    logger,
    options: kothConfig.directMessages,
  });

  const channelPolling = new PollingTask({
    name: 'koth-scheduler',
    intervalMs: kothConfig.scheduler.pollIntervalMs,
    logger,
    task: async () => {
      await scheduler.tick(clock.now());
    },
  });
  // Tarea aparte: repartir los MD con pausas puede durar minutos y no debe retrasar
  // los avisos del canal.
  const dmPolling = new PollingTask({
    name: 'koth-dm-dispatcher',
    intervalMs: kothConfig.scheduler.pollIntervalMs,
    logger,
    task: async (signal) => {
      await dmDispatcher.run(signal);
    },
  });

  return {
    commands: [createKothCommand(commandDependencies)],
    buttons: createKothSubscriptionButtons(commandDependencies),

    module: {
      name: 'koth',

      async start() {
        await announcer.verifyChannel();
        await verifySubscriptionChannel();

        const now = clock.now();
        const cutoff = now.minus({ days: kothConfig.scheduler.historyRetentionDays });
        const pruned =
          notificationRepository.deleteEventsBefore(cutoff) +
          deliveryRepository.deleteEventsBefore(cutoff);
        logger.info({ pruned }, 'Historial antiguo de avisos depurado');

        channelPolling.start();
        dmPolling.start();

        const next = timeService.getNextOccurrence(now);
        logger.info(
          {
            koth: next.slot.name,
            startsAt: next.startsAt.toISO(),
            subscribers: subscriptions.list().length,
          },
          'Scheduler de KOTH en marcha',
        );
      },

      async stop() {
        await Promise.all([channelPolling.stop(), dmPolling.stop()]);
      },
    },
  };

  /** El canal de suscripción es opcional: si falla, solo se avisa en el log. */
  async function verifySubscriptionChannel(): Promise<void> {
    if (subscriptionChannelId === undefined) return;
    try {
      await panelGateway.verifyChannel(subscriptionChannelId);
    } catch (error: unknown) {
      logger.warn(
        { err: error, channelId: subscriptionChannelId },
        'No se puede usar el canal de suscripción: revisa los permisos del bot en ese canal',
      );
    }
  }
}

function toMessageContext(env: Env, icons: IconResolver): MessageContext {
  return {
    serverIp: env.MINECRAFT_SERVER_IP,
    timezone: env.TIMEZONE,
    mentionEveryone: kothConfig.mentionEveryone,
    icons,
    voiceChannelId: env.DISCORD_VOICE_CHANNEL_ID ?? null,
    subscriptionChannelId: env.DISCORD_SUBSCRIPTION_CHANNEL_ID ?? null,
  };
}
