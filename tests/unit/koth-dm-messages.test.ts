import { describe, expect, it } from 'vitest';
import {
  buildDirectReminderMessage,
  buildDirectReminderPreviewMessage,
  buildSubscribersEmbeds,
  buildSubscriptionConfirmationDm,
  buildDmsClosedReply,
  buildNoSubscribersReply,
  buildPreviewFailedReply,
  buildSubscribedReply,
  buildSubscriberNotFoundReply,
  buildSubscriberRemovedReply,
  buildUnsubscribedReply,
} from '../../src/modules/koth/templates/koth-dm-messages.js';
import { createMessageContext } from '../helpers/direct-messages.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();
const occurrence = timeService.getNextOccurrence(madrid('2026-11-09T12:00'));
const [reminder] = timeService.getReminders(occurrence);
const startUnix = Math.floor(occurrence.startsAt.toSeconds());
const UNICODE_EMOJI = /\p{Extended_Pictographic}/u;
const context = createMessageContext();
const { icons } = context;

describe('MD de KOTH para suscriptores', () => {
  it('dice qué KOTH va a empezar y cuándo, con la cuenta atrás de Discord', () => {
    const { content } = buildDirectReminderMessage(reminder!, context);

    expect(content).toContain('KOTH 1');
    expect(content).toContain('está a punto de empezar');
    expect(content).toContain(`<t:${startUnix}:R>`);
    expect(content).toContain(`<t:${startUnix}:F>`);
  });

  it('el titular no promete una antelación fija, porque el MD puede salir con retraso', () => {
    const { content } = buildDirectReminderMessage(reminder!, context);

    expect(content).not.toMatch(/\b10 min/);
  });

  it('invita a conectarse al call y enlaza el canal de voz cuando está configurado', () => {
    const withVoice = createMessageContext({ voiceChannelId: '1234567890123456789' });

    const { content } = buildDirectReminderMessage(reminder!, withVoice);

    expect(content).toContain('Conéctate ya al call');
    expect(content).toContain('<#1234567890123456789>');
  });

  it('sin canal de voz configurado menciona el canal de voz del servidor', () => {
    const { content } = buildDirectReminderMessage(reminder!, context);

    expect(content).toContain('el canal de voz del servidor');
    expect(content).not.toContain('<#');
  });

  it('incluye la IP del servidor y cómo darse de baja', () => {
    const { content } = buildDirectReminderMessage(reminder!, context);

    expect(content).toContain('`boutcraft.xyz`');
    expect(content).toContain('/koth cancelar');
  });

  it('no usa emojis Unicode cuando los iconos están cargados', () => {
    const texts = [
      buildDirectReminderMessage(reminder!, context).content,
      buildDirectReminderPreviewMessage(reminder!, context).content,
      buildSubscriptionConfirmationDm(context).content,
      buildSubscribedReply(icons),
      buildDmsClosedReply(icons),
      buildUnsubscribedReply(icons),
      buildNoSubscribersReply(icons),
      buildSubscriberRemovedReply('123', icons),
      buildSubscriberNotFoundReply('123', icons),
      buildPreviewFailedReply({ kind: 'dms-closed' }, icons),
      JSON.stringify(buildSubscribersEmbeds([], { icons })),
    ];

    for (const text of texts) expect(text).not.toMatch(UNICODE_EMOJI);
  });

  it('la vista previa se marca como prueba y conserva el contenido del MD real', () => {
    const real = buildDirectReminderMessage(reminder!, context).content;
    const { content } = buildDirectReminderPreviewMessage(reminder!, context);

    expect(content).toContain('MENSAJE DE PRUEBA');
    expect(content).toContain(real);
  });

  it('los MD indican dónde darse de baja: el canal de suscripción si hay uno configurado', () => {
    const withChannel = createMessageContext({ subscriptionChannelId: '1570918164261376220' });

    const real = buildDirectReminderMessage(reminder!, withChannel).content;
    const confirmation = buildSubscriptionConfirmationDm(withChannel).content;
    const withoutChannel = buildDirectReminderMessage(reminder!, context).content;

    expect(real).toContain('<#1570918164261376220>');
    expect(confirmation).toContain('<#1570918164261376220>');
    expect(withoutChannel).toContain('usa `/koth cancelar` en el servidor');
  });

  it('el MD de confirmación explica cómo cancelar', () => {
    const { content } = buildSubscriptionConfirmationDm(context);

    expect(content).toContain('estás suscrito');
    expect(content).toContain('/koth cancelar');
  });

  it('los MD no mencionan a @everyone ni a @here', () => {
    const texts = [
      buildDirectReminderMessage(reminder!, createMessageContext({ mentionEveryone: true }))
        .content,
      buildSubscriptionConfirmationDm(context).content,
    ];

    for (const text of texts) expect(text).not.toMatch(/@everyone|@here/);
  });
});

describe('lista de suscriptores', () => {
  function makeSubscribers(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      userId: String(100_000_000_000_000_000n + BigInt(index)),
      subscribedAt: '2026-11-09T16:00:00.000Z',
      consecutiveFailures: 0,
    }));
  }

  it('muestra a cada suscriptor mencionado, con su fecha de alta', () => {
    const [embed] = buildSubscribersEmbeds(makeSubscribers(2), { icons }).map((e) => e.toJSON());

    expect(embed?.description).toContain('1. <@100000000000000000>');
    expect(embed?.description).toContain('2. <@100000000000000001>');
    expect(embed?.description).toContain('<t:1794240000:d>');
    expect(embed?.footer?.text).toContain('2 suscriptores');
  });

  it('usa el singular con un solo suscriptor', () => {
    const [embed] = buildSubscribersEmbeds(makeSubscribers(1), { icons }).map((e) => e.toJSON());

    expect(embed?.footer?.text).toContain('1 suscriptor ');
  });

  it('reparte listas largas en varios embeds sin pasarse del límite de Discord', () => {
    const subscribers = makeSubscribers(400);

    const embeds = buildSubscribersEmbeds(subscribers, { icons }).map((e) => e.toJSON());
    const allText = embeds.map((embed) => embed.description ?? '').join('\n');

    expect(embeds.length).toBeGreaterThan(1);
    for (const embed of embeds) expect((embed.description ?? '').length).toBeLessThanOrEqual(4096);
    expect(allText.match(/<@\d+>/g)).toHaveLength(400);
    expect(embeds[0]?.title).toBeDefined();
    expect(embeds[1]?.title).toBeUndefined();
    expect(embeds.at(-1)?.footer?.text).toContain(`página ${embeds.length} de ${embeds.length}`);
  });
});
