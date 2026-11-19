import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { vi } from 'vitest';
import type { KothCommandDependencies } from '../../src/modules/koth/commands/koth-command.dependencies.js';
import type { KothSubscriptionPanelGateway } from '../../src/modules/koth/domain/koth.ports.js';
import { SqliteKothPanelMessageRepository } from '../../src/modules/koth/repositories/sqlite-koth-panel-message.repository.js';
import { SqliteKothPauseStateRepository } from '../../src/modules/koth/repositories/sqlite-koth-pause-state.repository.js';
import { KothPauseService } from '../../src/modules/koth/services/koth-pause.service.js';
import { KothSubscriptionPanelService } from '../../src/modules/koth/services/koth-subscription-panel.service.js';
import { createMessageContext, type DmHarness } from './direct-messages.js';
import { silentLogger } from './scheduler.js';
import { createTimeService } from './time.js';

type ReplyPayload = string | { content?: string; flags?: unknown; embeds?: unknown[] };
type ReplyMock = ReturnType<typeof vi.fn<(payload: ReplyPayload) => Promise<void>>>;

/** Interacción simulada: guarda lo que el bot responde para poder comprobarlo. */
interface FakeInteractionBase {
  readonly reply: ReplyMock;
  readonly deferReply: ReplyMock;
  readonly editReply: ReplyMock;
  readonly followUp: ReplyMock;
  /** Texto de todas las respuestas (reply, editReply y followUp), en orden. */
  texts(): string[];
}

export interface FakeChatInteraction extends FakeInteractionBase {
  readonly interaction: ChatInputCommandInteraction;
}

export interface FakeButtonInteraction extends FakeInteractionBase {
  readonly interaction: ButtonInteraction;
}

export interface FakeChatInteractionOptions {
  readonly userId?: string;
  readonly channelId?: string;
  /** Si se indica, el comando se ejecuta dentro de un hilo cuyo canal padre es este. */
  readonly threadParentId?: string;
  readonly canManageServer?: boolean;
  /** Usuario objetivo de una opción de tipo usuario (p. ej. `/koth quitar`). */
  readonly targetUserId?: string;
}

function createReplyMocks(): Omit<FakeInteractionBase, 'texts'> & {
  state: { replied: boolean; deferred: boolean };
} {
  const state = { replied: false, deferred: false };
  const reply = vi.fn<(payload: ReplyPayload) => Promise<void>>(() => {
    state.replied = true;
    return Promise.resolve();
  });
  const deferReply = vi.fn<(payload: ReplyPayload) => Promise<void>>(() => {
    state.deferred = true;
    return Promise.resolve();
  });
  const editReply = vi.fn<(payload: ReplyPayload) => Promise<void>>(() => Promise.resolve());
  const followUp = vi.fn<(payload: ReplyPayload) => Promise<void>>(() => Promise.resolve());
  return { state, reply, deferReply, editReply, followUp };
}

function collectTexts(mocks: Omit<FakeInteractionBase, 'texts'>): string[] {
  return [...mocks.reply.mock.calls, ...mocks.editReply.mock.calls, ...mocks.followUp.mock.calls]
    .map(([payload]) => (typeof payload === 'string' ? payload : (payload.content ?? '')))
    .filter((text) => text.length > 0);
}

export function createFakeChatInteraction(
  options: FakeChatInteractionOptions = {},
): FakeChatInteraction {
  const mocks = createReplyMocks();
  const interaction = {
    channelId: options.channelId ?? 'canal-cualquiera',
    channel:
      options.threadParentId === undefined
        ? null
        : { isThread: () => true, parentId: options.threadParentId },
    user: { id: options.userId ?? 'u1' },
    memberPermissions: { has: () => options.canManageServer ?? false },
    options: { getUser: () => ({ id: options.targetUserId ?? 'objetivo' }) },
    get replied() {
      return mocks.state.replied;
    },
    get deferred() {
      return mocks.state.deferred;
    },
    reply: mocks.reply,
    deferReply: mocks.deferReply,
    editReply: mocks.editReply,
    followUp: mocks.followUp,
  } as unknown as ChatInputCommandInteraction;

  return { interaction, ...mocks, texts: () => collectTexts(mocks) };
}

export function createFakeButtonInteraction(
  customId: string,
  userId = 'u1',
): FakeButtonInteraction {
  const mocks = createReplyMocks();
  const interaction = {
    customId,
    user: { id: userId },
    get replied() {
      return mocks.state.replied;
    },
    get deferred() {
      return mocks.state.deferred;
    },
    reply: mocks.reply,
    deferReply: mocks.deferReply,
    editReply: mocks.editReply,
    followUp: mocks.followUp,
  } as unknown as ButtonInteraction;

  return { interaction, ...mocks, texts: () => collectTexts(mocks) };
}

/** Puerto del panel simulado: registra qué se publica y qué se actualiza. */
export class FakePanelGateway implements KothSubscriptionPanelGateway {
  readonly created: { channelId: string; messageId: string }[] = [];
  readonly updated: { channelId: string; messageId: string }[] = [];
  private messageExists = true;
  private failure: Error | undefined;

  /** Simula que el mensaje del panel fue borrado a mano. */
  deleteStoredMessage(): void {
    this.messageExists = false;
  }

  failWith(error: Error): void {
    this.failure = error;
  }

  create(channelId: string): Promise<{ readonly messageId: string }> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    const messageId = `panel-${this.created.length + 1}`;
    this.created.push({ channelId, messageId });
    this.messageExists = true;
    return Promise.resolve({ messageId });
  }

  update(channelId: string, messageId: string): Promise<boolean> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (this.messageExists) this.updated.push({ channelId, messageId });
    return Promise.resolve(this.messageExists);
  }
}

export const SUBSCRIPTION_CHANNEL_ID = '1570918164261376220';

/** Servicio de apagado/encendido sobre la base de datos del banco de pruebas. */
export function createPauseService(harness: DmHarness): KothPauseService {
  return new KothPauseService({
    repository: new SqliteKothPauseStateRepository(harness.database),
    clock: harness.clock,
    logger: silentLogger,
  });
}

export interface CommandDependenciesOptions {
  /** `null` simula que no hay canal de suscripción configurado. */
  readonly subscriptionChannelId?: string | null;
  readonly gateway?: FakePanelGateway;
}

/** Dependencias reales de los comandos sobre el banco de pruebas (base de datos en memoria). */
export function createCommandDependencies(
  harness: DmHarness,
  options: CommandDependenciesOptions = {},
): KothCommandDependencies {
  const subscriptionChannelId =
    options.subscriptionChannelId === undefined
      ? SUBSCRIPTION_CHANNEL_ID
      : options.subscriptionChannelId;

  return {
    timeService: createTimeService(),
    clock: harness.clock,
    messageContext: createMessageContext({ subscriptionChannelId }),
    announcementChannelId: 'canal-de-avisos',
    subscriptions: harness.subscriptions,
    messenger: harness.messenger,
    pause: createPauseService(harness),
    panel:
      subscriptionChannelId === null
        ? null
        : new KothSubscriptionPanelService({
            channelId: subscriptionChannelId,
            panels: new SqliteKothPanelMessageRepository(harness.database),
            gateway: options.gateway ?? new FakePanelGateway(),
            clock: harness.clock,
          }),
  };
}
