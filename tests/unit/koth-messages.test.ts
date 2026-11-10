import { describe, expect, it } from 'vitest';
import {
  buildNextKothEmbed,
  buildNoPermissionMessage,
  buildReminderMessage,
  buildReminderNotConfiguredMessage,
  buildScheduleEmbed,
  buildTestFailedMessage,
  buildTestPublishedMessage,
  buildTestReminderMessage,
  type MessageContext,
} from '../../src/modules/koth/templates/koth-messages.js';
import { createLoadedIconRegistry } from '../helpers/icons.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();
const icons = createLoadedIconRegistry();
const context: MessageContext = {
  serverIp: 'boutcraft.xyz',
  timezone: 'Europe/Madrid',
  mentionEveryone: true,
  icons,
};
const contextWithoutMentions: MessageContext = { ...context, mentionEveryone: false };
/** Cualquier emoji Unicode (⚔️, 🔥, ✅...). Los emojis personalizados `<:x:1>` no lo cumplen. */
const UNICODE_EMOJI = /\p{Extended_Pictographic}/u;
const occurrence = timeService.getNextOccurrence(madrid('2026-11-09T12:00'));
const startUnix = Math.floor(occurrence.startsAt.toSeconds());

describe('Templates de mensajes KOTH', () => {
  it('el aviso usa el timestamp del inicio del KOTH, no del envío', () => {
    const [reminder] = timeService.getReminders(occurrence);
    const { content } = buildReminderMessage(reminder!, context);

    expect(content).toContain(`<t:${startUnix}:F>`);
    expect(content).toContain(`<t:${startUnix}:R>`);
    expect(content).not.toContain(`<t:${Math.floor(reminder!.firesAt.toSeconds())}`);
  });

  it('el aviso incluye nombre del evento, hora oficial e IP', () => {
    const [reminder] = timeService.getReminders(occurrence);
    const { content } = buildReminderMessage(reminder!, context);

    expect(content).toContain('KOTH 1');
    expect(content).toContain('17:00');
    expect(content).toContain('`boutcraft.xyz`');
  });

  it('el aviso termina con @everyone y @here y permite notificarlos', () => {
    for (const reminder of timeService.getReminders(occurrence)) {
      const message = buildReminderMessage(reminder, context);

      expect(message.content?.endsWith('\n\n@everyone @here')).toBe(true);
      expect(message.allowedMentions).toEqual({ parse: ['everyone'] });
    }
  });

  it('sin mentionEveryone el aviso no menciona a nadie ni declara menciones permitidas', () => {
    const [reminder] = timeService.getReminders(occurrence);
    const message = buildReminderMessage(reminder!, contextWithoutMentions);

    expect(message.content).not.toContain('@everyone');
    expect(message.content).not.toContain('@here');
    expect(message.allowedMentions).toBeUndefined();
  });

  it('el mensaje de prueba se identifica como tal y conserva el formato del aviso real', () => {
    const [reminder] = timeService.getReminders(occurrence);
    const { content } = buildTestReminderMessage(reminder!, context);

    expect(content).toContain('MENSAJE DE PRUEBA');
    expect(content).toContain('¡KOTH 1 en Boutcraft dentro de 1 hora!');
    expect(content).toContain(`<t:${startUnix}:F>`);
    expect(content).toContain(`<t:${startUnix}:R>`);
  });

  it('el mensaje de prueba muestra las menciones como código y no notifica a nadie', () => {
    const [reminder] = timeService.getReminders(occurrence);
    const message = buildTestReminderMessage(reminder!, context);

    expect(message.content).toContain('`@everyone @here`');
    expect(message.content).not.toMatch(/(^|[^`])@everyone/);
    expect(message.allowedMentions).toBeUndefined();
  });

  it('el texto varía según el tiempo restante', () => {
    const contents = timeService
      .getReminders(occurrence)
      .map((reminder) => buildReminderMessage(reminder, context).content);

    expect(new Set(contents).size).toBe(3);
    expect(contents[0]).toContain('1 hora');
    expect(contents[1]).toContain('30 minutos');
    expect(contents[2]).toContain('10 minutos');
  });

  it('/koth siguiente muestra hora, fecha, tiempo restante y timestamp dinámico', () => {
    const embed = buildNextKothEmbed(occurrence, madrid('2026-11-09T14:45'), context).toJSON();
    const text = JSON.stringify(embed);

    expect(embed.title).toContain('KOTH 1');
    expect(text).toContain('17:00');
    expect(text).toContain(`<t:${startUnix}:D>`);
    expect(text).toContain(`<t:${startUnix}:R>`);
    expect(text).toContain('2 h 15 min');
  });

  it('/koth horarios muestra los tres horarios oficiales', () => {
    const embed = buildScheduleEmbed(
      timeService.getNextOccurrencePerSlot(madrid('2026-11-09T12:00')),
      timeService.reminderOffsetsMinutes,
      context,
    ).toJSON();
    const kothFields = embed.fields?.filter((field) => field.name.includes('KOTH')) ?? [];

    const swords = icons.get('swords');
    expect(kothFields.map((field) => field.name)).toEqual([
      `${swords} KOTH 1`,
      `${swords} KOTH 2`,
      `${swords} KOTH 3`,
    ]);
    const officialTime = /\*\*(\d{2}:\d{2})\*\*/;
    expect(kothFields.map((field) => officialTime.exec(field.value)?.[1])).toEqual([
      '17:00',
      '22:00',
      '02:00',
    ]);
    expect(embed.description).toContain('1 h, 30 min y 10 min');
  });

  describe('iconos de Lucide', () => {
    it('los avisos usan el emoji personalizado de cada antelación', () => {
      const [first, second, third] = timeService
        .getReminders(occurrence)
        .map((reminder) => buildReminderMessage(reminder, context).content);

      expect(first).toContain(`${icons.get('swords')} **¡KOTH 1 en Boutcraft dentro de 1 hora!**`);
      expect(second).toContain(`${icons.get('shield')} **¡KOTH 1`);
      expect(third).toContain(`${icons.get('flame')} **¡KOTH 1`);
      expect(icons.get('swords')).toMatch(/^<:lc_swords:\d+>$/);
    });

    it('ningún mensaje ni embed contiene emojis Unicode cuando los iconos están cargados', () => {
      const [reminder] = timeService.getReminders(occurrence);
      const texts = [
        buildReminderMessage(reminder!, context).content,
        buildReminderMessage(reminder!, contextWithoutMentions).content,
        buildTestReminderMessage(reminder!, context).content,
        JSON.stringify(buildNextKothEmbed(occurrence, madrid('2026-11-09T14:45'), context)),
        JSON.stringify(
          buildScheduleEmbed(
            timeService.getNextOccurrencePerSlot(madrid('2026-11-09T12:00')),
            timeService.reminderOffsetsMinutes,
            context,
          ),
        ),
        buildNoPermissionMessage(icons),
        buildReminderNotConfiguredMessage(45, icons),
        buildTestFailedMessage('123', 'Missing Access', icons),
        buildTestPublishedMessage(60, '123', icons),
      ];

      for (const text of texts) {
        expect(text).not.toMatch(UNICODE_EMOJI);
      }
    });
  });
});
