import { describe, expect, it } from 'vitest';
import {
  buildNextKothEmbed,
  buildReminderMessage,
  buildScheduleEmbed,
  buildTestReminderMessage,
} from '../../src/modules/koth/templates/koth-messages.js';
import { createTimeService, madrid } from '../helpers/time.js';

const timeService = createTimeService();
const context = { serverIp: 'boutcraft.xyz', timezone: 'Europe/Madrid', mentionEveryone: true };
const contextWithoutMentions = { ...context, mentionEveryone: false };
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

    expect(kothFields.map((field) => field.name)).toEqual(['⚔️ KOTH 1', '⚔️ KOTH 2', '⚔️ KOTH 3']);
    const officialTime = /\*\*(\d{2}:\d{2})\*\*/;
    expect(kothFields.map((field) => officialTime.exec(field.value)?.[1])).toEqual([
      '17:00',
      '22:00',
      '02:00',
    ]);
    expect(embed.description).toContain('1 h, 30 min y 10 min');
  });
});
