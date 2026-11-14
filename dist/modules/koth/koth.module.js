import { kothConfig } from '../../config/koth.config.js';
import { PollingTask } from '../../shared/utils/polling-task.js';
import { sleep } from '../../shared/utils/sleep.js';
import { createKothCommand } from './commands/koth.command.js';
import { SqliteKothDmDeliveryRepository } from './repositories/sqlite-koth-dm-delivery.repository.js';
import { SqliteKothNotificationRepository } from './repositories/sqlite-koth-notification.repository.js';
import { SqliteKothSubscriberRepository } from './repositories/sqlite-koth-subscriber.repository.js';
import { KothDmDispatcherService } from './services/koth-dm-dispatcher.service.js';
import { DiscordKothDirectMessenger } from './services/koth-direct-message.service.js';
import { DiscordKothAnnouncer } from './services/koth-notification.service.js';
import { KothSchedulerService } from './services/koth-scheduler.service.js';
import { KothSubscriptionService } from './services/koth-subscription.service.js';
import { KothTimeService } from './services/koth-time.service.js';
export function createKothTimeService(timezone) {
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
export function createKothModule(context) {
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
        commands: [
            createKothCommand({
                timeService,
                clock,
                messageContext,
                announcementChannelId: env.DISCORD_CHANNEL_ID,
                subscriptions,
                messenger,
            }),
        ],
        module: {
            name: 'koth',
            async start() {
                await announcer.verifyChannel();
                const now = clock.now();
                const cutoff = now.minus({ days: kothConfig.scheduler.historyRetentionDays });
                const pruned = notificationRepository.deleteEventsBefore(cutoff) +
                    deliveryRepository.deleteEventsBefore(cutoff);
                logger.info({ pruned }, 'Historial antiguo de avisos depurado');
                channelPolling.start();
                dmPolling.start();
                const next = timeService.getNextOccurrence(now);
                logger.info({
                    koth: next.slot.name,
                    startsAt: next.startsAt.toISO(),
                    subscribers: subscriptions.list().length,
                }, 'Scheduler de KOTH en marcha');
            },
            async stop() {
                await Promise.all([channelPolling.stop(), dmPolling.stop()]);
            },
        },
    };
}
function toMessageContext(env, icons) {
    return {
        serverIp: env.MINECRAFT_SERVER_IP,
        timezone: env.TIMEZONE,
        mentionEveryone: kothConfig.mentionEveryone,
        icons,
        voiceChannelId: env.DISCORD_VOICE_CHANNEL_ID ?? null,
    };
}
//# sourceMappingURL=koth.module.js.map