# Boutcraft KOTH Bot

Bot de Discord para el servidor de Minecraft **Boutcraft** (`boutcraft.xyz`). Anuncia automáticamente los eventos **KOTH (King of the Hill)** y ofrece comandos slash para consultar los horarios.

- Tres KOTH diarios: **17:00**, **22:00** y **02:00** (hora oficial de España, `Europe/Madrid`).
- Avisos automáticos **60, 30 y 10 minutos** antes de cada KOTH.
- Cambios de horario de verano e invierno gestionados de forma automática.
- Sin duplicados, también después de reiniciar el bot (persistencia en SQLite).
- Comandos `/koth siguiente` y `/koth horarios`.

---

## Índice

1. [Requisitos](#requisitos)
2. [Configuración en Discord Developer Portal](#configuración-en-discord-developer-portal)
3. [Instalación](#instalación)
4. [Variables de entorno](#variables-de-entorno)
5. [Registro de comandos slash](#registro-de-comandos-slash)
6. [Iconos (Lucide)](#iconos-lucide)
7. [Desarrollo local](#desarrollo-local)
8. [Compilación y producción](#compilación-y-producción)
9. [Calidad: lint, tipos y tests](#calidad-lint-tipos-y-tests)
10. [Funcionamiento del scheduler](#funcionamiento-del-scheduler)
11. [Persistencia con SQLite](#persistencia-con-sqlite)
12. [Arquitectura](#arquitectura)
13. [Cómo ampliar el bot](#cómo-ampliar-el-bot)

---

## Requisitos

| Herramienta | Versión                                                    |
| ----------- | ---------------------------------------------------------- |
| Node.js     | **24 LTS o superior** (usa el módulo nativo `node:sqlite`) |
| pnpm        | 10.x (`corepack enable` o `npm install -g pnpm`)           |

No hace falta compilar dependencias nativas: SQLite viene incluido en Node.js.

## Configuración en Discord Developer Portal

1. Entra en <https://discord.com/developers/applications> y pulsa **New Application**. Ponle un nombre, por ejemplo _Boutcraft KOTH_.
2. En **General Information**, copia el **Application ID**. Es tu `DISCORD_CLIENT_ID`.
3. En **Bot**:
   - Pulsa **Reset Token** y copia el token. Es tu `DISCORD_TOKEN`. **No lo compartas nunca**: si se filtra, vuelve a generarlo.
   - No hace falta activar ningún _Privileged Gateway Intent_.
4. En **OAuth2 → URL Generator**:
   - Scopes: `bot` y `applications.commands`.
   - Bot permissions: `View Channels`, `Send Messages` y `Embed Links`. Si activas `mentionEveryone` en `koth.config.ts` (desactivado por defecto), añade también `Mention Everyone`.
   - Abre la URL generada e invita el bot a tu servidor. Si lo prefieres, también puedes usar esta plantilla (permisos `19456`):
     ```
     https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&scope=bot+applications.commands&permissions=19456
     ```
5. En Discord, activa **Ajustes → Avanzado → Modo desarrollador** y luego:
   - Haz clic derecho en el servidor → **Copiar ID del servidor**. Es tu `DISCORD_GUILD_ID`.
   - Haz clic derecho en el canal de anuncios → **Copiar ID del canal**. Es tu `DISCORD_CHANNEL_ID`.
6. Comprueba que el bot puede ver y escribir en el canal de anuncios, por si el canal tiene permisos restringidos.

## Instalación

```bash
pnpm install
cp .env.example .env    # en Windows PowerShell: Copy-Item .env.example .env
```

Después rellena `.env` con tus valores.

## Variables de entorno

Se validan con **Zod** al arrancar. Si falta alguna o es inválida, el bot no arranca y muestra exactamente qué corregir.

| Variable              | Obligatoria | Por defecto               | Descripción                                                                               |
| --------------------- | :---------: | ------------------------- | ----------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`       |     ✅      | —                         | Token del bot.                                                                            |
| `DISCORD_CLIENT_ID`   |     ✅      | —                         | Application ID.                                                                           |
| `DISCORD_GUILD_ID`    |     ✅      | —                         | Servidor donde se registran los comandos.                                                 |
| `DISCORD_CHANNEL_ID`  |     ✅      | —                         | Canal donde se publican los avisos.                                                       |
| `TIMEZONE`            |             | `Europe/Madrid`           | Zona horaria **IANA** oficial (no uses `UTC+1`).                                          |
| `MINECRAFT_SERVER_IP` |             | `boutcraft.xyz`           | IP que aparece en los mensajes (no usa el nombre `SERVER_IP`, que muchos hosts reservan). |
| `DATABASE_PATH`       |             | `./data/boutcraft.sqlite` | Ruta del fichero SQLite (la carpeta se crea sola).                                        |
| `LOG_LEVEL`           |             | `info`                    | `fatal`, `error`, `warn`, `info`, `debug`, `trace` o `silent`.                            |

> Los horarios, los avisos y los parámetros del scheduler **no** están en `.env`: están centralizados en [`src/config/koth.config.ts`](src/config/koth.config.ts).
>
> Los avisos **no** mencionan a nadie (`mentionEveryone: false`); las menciones a `@everyone` y `@here` se hacen a mano. Para que cada aviso termine con `@everyone @here`, pon `mentionEveryone: true` en ese mismo archivo. Los mensajes de `/koth prueba` nunca notifican a nadie.

## Registro de comandos slash

Los comandos se registran a nivel de servidor (guild), así que aparecen al instante:

```bash
pnpm commands:deploy           # desde el código fuente (desarrollo)
pnpm commands:deploy:prod      # desde dist/ (tras pnpm build)
```

Solo hay que repetirlo cuando cambian los comandos (nombres, descripciones u opciones), no en cada arranque.

| Comando           | Descripción                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `/koth siguiente` | Próximo KOTH: hora de inicio, fecha, tiempo restante y timestamp dinámico.        |
| `/koth horarios`  | Los tres horarios oficiales, con la hora local de cada usuario y la cuenta atrás. |

## Iconos (Lucide)

Los mensajes usan iconos de [Lucide](https://lucide.dev/icons) en lugar de emojis Unicode. Discord no puede renderizar componentes de React ni SVG, así que los iconos se convierten a PNG y se suben como **emojis de la aplicación** (los ves en el Developer Portal → **Emojis**). Los emojis de aplicación son privados del bot: funcionan en cualquier servidor sin que tengas que subirlos a cada uno.

```bash
pnpm icons:sync            # sube solo los iconos que faltan (se puede repetir sin problema)
pnpm icons:sync --force    # vuelve a crear todos (p. ej. tras cambiar un color)
```

Después de sincronizar, reinicia el bot. Al arrancar carga los emojis y registra cuántos encontró. Si faltan, avisa en el log y usa mientras tanto un emoji Unicode de respaldo, así que el bot nunca se queda sin iconos.

- El catálogo está en [`src/shared/icons/icon-catalog.ts`](src/shared/icons/icon-catalog.ts): cada icono tiene su nombre de Lucide, su color y su respaldo.
- Para añadir un icono: agrégalo al catálogo, ejecuta `pnpm icons:sync`, reinicia el bot y úsalo en los templates con `context.icons.get('nombre')`. Nunca escribas emojis literales en los templates.
- Los emojis se llaman `lc_<icono>` (por ejemplo `lc_swords`, `lc_calendar_days`).
- `lucide-static` y `@resvg/resvg-js` son dependencias de **desarrollo**: solo se usan en `icons:sync`, que debes ejecutar desde tu máquina de desarrollo. El bot en producción no las necesita.

## Desarrollo local

```bash
pnpm dev
```

Arranca con `tsx` en modo _watch_ (se reinicia al guardar) y muestra los logs formateados con `pino-pretty`.

## Compilación y producción

```bash
pnpm install --frozen-lockfile
pnpm build                  # compila TypeScript a dist/
pnpm commands:deploy:prod   # solo la primera vez o si cambian los comandos
pnpm start                  # node dist/index.js
```

En producción los logs se escriben en **JSON estructurado** (Pino), listos para recolectores de logs. El bot captura `SIGINT` y `SIGTERM` para apagarse limpiamente: termina el tick en curso, desconecta de Discord y cierra la base de datos.

Para mantenerlo activo 24/7 usa un gestor de procesos que lo reinicie si se cae:

**PM2**

```bash
pnpm add -g pm2
pm2 start dist/index.js --name boutcraft-koth
pm2 save && pm2 startup
```

**systemd** (Linux)

```ini
[Unit]
Description=Boutcraft KOTH Bot
After=network-online.target

[Service]
WorkingDirectory=/opt/boutcraft-koth-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

> ⚠️ No ejecutes el bot en producción dentro de una carpeta sincronizada (OneDrive, Dropbox...). La sincronización puede bloquear o corromper el fichero SQLite. Si es necesario, apunta `DATABASE_PATH` a una ruta local.

## Calidad: lint, tipos y tests

```bash
pnpm typecheck      # TypeScript estricto (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
pnpm lint           # ESLint con reglas type-checked estrictas
pnpm format         # Prettier (format:check para verificar sin modificar)
pnpm test           # Vitest
pnpm check          # todo lo anterior en secuencia
```

Las pruebas son **deterministas**: no dependen de la hora del sistema. Usan fechas simuladas y se ejecutan con `TZ=UTC` para que la zona de la máquina no influya. Cubren:

- Cálculo del siguiente KOTH y de los avisos de 60, 30 y 10 minutos.
- Eventos que cruzan la medianoche y el cambio de año.
- Cambio de horario verano → invierno (hora repetida) e invierno → verano (hora inexistente).
- Simulación de un día completo de polling.
- Recuperación tras reinicios, con una base de datos real en fichero.
- Prevención de duplicados: ticks repetidos, ticks concurrentes y dos instancias sobre la misma BD.
- Arranque tardío: avisos atrasados, avisos sustituidos y KOTH ya iniciados.
- Reintentos ante fallos de Discord.

## Funcionamiento del scheduler

### Polling controlado, sin `setTimeout` encadenados

`PollingTask` ejecuta un **tick cada 10 segundos** y garantiza que nunca haya dos ticks simultáneos. En cada tick, `KothSchedulerService` **recalcula desde cero** qué avisos tocan a partir del reloj actual. No guarda temporizadores ni estado en memoria, por lo que:

- no importa a qué hora se arranque el bot;
- una suspensión del equipo o un retraso del event loop no provocan pérdidas ni duplicados;
- un reinicio no necesita ningún paso de recuperación especial.

### Algoritmo de cada tick

Para cada KOTH que **aún no ha comenzado** y empieza en los próximos 60 minutos:

1. Se calculan sus avisos (`inicio − 60/30/10 min`) y se seleccionan los ya vencidos.
2. Solo se considera el **aviso vencido más reciente**. Los anteriores no enviados se registran como `skipped (superseded)`. Si el bot arranca a las 16:33, no publica el aviso de "1 hora" sino el de "30 minutos".
3. Si ese aviso lleva más de **5 minutos** de retraso (`maxLatenessMs`), se omite (`skipped (too-late)`) en lugar de publicar un mensaje desactualizado.
4. Envío en tres pasos, **reservar → enviar → confirmar**:
   - **Reservar:** `INSERT … ON CONFLICT DO NOTHING` sobre una clave única. Solo un proceso obtiene la reserva.
   - **Enviar** el mensaje a Discord.
   - **Confirmar** con `status = 'sent'` y el ID del mensaje.
   - Si Discord falla, se **libera** la reserva y se reintenta en el siguiente tick, dentro del margen de 5 minutos.

Los KOTH que ya han comenzado nunca se anuncian.

### Zonas horarias y cambios de horario

Las horas se definen como **hora de reloj** en `Europe/Madrid` y se convierten a instantes exactos con la base de datos IANA (Luxon). No se usan offsets fijos.

| Situación                                     | Comportamiento                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Horario normal                                | 17:00 → avisos 16:00, 16:30 y 16:50.                                                                                                                                                          |
| KOTH de las 02:00                             | Pertenece al día natural siguiente al KOTH de las 22:00.                                                                                                                                      |
| **Último domingo de marzo** (02:00 → 03:00)   | Las 02:00 no existen ese día. El KOTH se resuelve al primer instante válido (**03:00 CEST**, el mismo instante que las 02:00 de invierno). Los avisos se publican a las 01:00, 01:30 y 01:50. |
| **Último domingo de octubre** (03:00 → 02:00) | Las 02:00 ocurren dos veces. Se usa **la primera**, igual que `cron`, y el KOTH se anuncia **una sola vez**. Los avisos se publican a las 01:00, 01:30 y 01:50 CEST.                          |

Los avisos se calculan restando **duraciones absolutas**: "60 minutos antes" son siempre 60 minutos reales. Las claves y las fechas guardadas usan **UTC ISO**, que es único e inmune a los cambios de horario.

### Formato de los mensajes

Ejemplo de aviso publicado en el canal:

```
⚔️ **¡KOTH 1 en Boutcraft dentro de 1 hora!**
Prepara tu kit y reúne a tu equipo: la colina se disputa muy pronto.

📅 **Fecha:** <t:1794240000:F>
⏳ **Comienza:** <t:1794240000:R>
🕐 **Hora oficial (España):** 17:00
🌐 **IP:** `boutcraft.xyz`
```

El timestamp representa el **inicio exacto del KOTH**, no el momento del envío. Discord lo muestra en la zona horaria de cada usuario y mantiene la cuenta atrás actualizada.

## Persistencia con SQLite

- Fichero: `DATABASE_PATH` (por defecto `./data/boutcraft.sqlite`, excluido de git).
- Driver: `node:sqlite`, integrado en Node.js, sin dependencias nativas.
- Modo **WAL** y `busy_timeout` para escrituras más robustas.
- **Migraciones versionadas** en [`src/infrastructure/database/migrations/`](src/infrastructure/database/migrations/). Se aplican automáticamente al arrancar, cada una en su transacción, y se registran en `schema_migrations`.
- Tabla `koth_notifications`: un registro por aviso, con estado `processing`, `sent` o `skipped`, motivo de omisión e ID del mensaje de Discord.
- El historial de más de **30 días** se depura al arrancar.

**Garantía de entrega:** el sistema prioriza **no duplicar**. Si el proceso muere justo entre el envío a Discord y la confirmación en la base de datos, el aviso queda en `processing` y no se reenvía. Es preferible perder ese aviso concreto a publicarlo dos veces.

Para reiniciar el historial basta con detener el bot y borrar el fichero `.sqlite` (y sus `-wal` y `-shm`).

## Arquitectura

```text
src/
├── config/
│   ├── env.ts                      # Variables de entorno validadas con Zod
│   └── koth.config.ts              # ÚNICO lugar con horarios, avisos y parámetros del scheduler
├── core/
│   ├── client.ts                   # Cliente de Discord (intents mínimos)
│   ├── logger.ts                   # Pino
│   └── commands/                   # Registro/despacho de comandos y comandos con subcomandos
├── events/                         # ready e interactionCreate
├── infrastructure/database/        # Conexión SQLite, migraciones y lectores tipados de filas
├── modules/
│   ├── index.ts                    # Registro de módulos y comandos
│   └── koth/
│       ├── domain/                 # Tipos, constantes, identificadores y puertos (sin dependencias)
│       ├── services/
│       │   ├── koth-time.service.ts          # Cálculos de calendario (puro)
│       │   ├── koth-scheduler.service.ts     # Qué enviar y cuándo (sin Discord)
│       │   └── koth-notification.service.ts  # Adaptador que publica en Discord
│       ├── repositories/           # Interfaz + implementación SQLite
│       ├── templates/              # Todos los textos y embeds del módulo
│       ├── commands/               # /koth siguiente, /koth horarios
│       └── koth.module.ts          # Composición del módulo
├── shared/                         # Reloj, polling, utilidades de tiempo y contratos comunes
├── scripts/deploy-commands.ts      # Registro de comandos slash
├── app.ts                          # Raíz de composición (inyección de dependencias)
└── index.ts                        # Punto de entrada y apagado limpio
tests/
├── unit/                           # Tiempo, scheduler, templates, polling, env
├── integration/                    # SQLite real y reinicios del bot
└── helpers/                        # Reloj simulado, announcer simulado, utilidades
```

Principios:

- **El dominio y los cálculos de tiempo no conocen Discord.** El scheduler depende de interfaces (`KothAnnouncer`, `KothNotificationRepository`), así que se prueba sin red y Discord se puede sustituir por otro canal.
- **Inyección de dependencias** explícita en `app.ts` y `koth.module.ts`, sin singletons globales.
- **El reloj se inyecta** (`Clock`), lo que hace que todas las pruebas sean deterministas.

## Cómo ampliar el bot

- **Cambiar horarios o avisos:** edita [`src/config/koth.config.ts`](src/config/koth.config.ts). La configuración se valida al arrancar: ids únicos, horas válidas y sin duplicados.
- **Nueva antelación de aviso (p. ej. 5 min):** añádela al tipo `ReminderOffsetMinutes`, al esquema de configuración y a `REMINDER_TEMPLATES`. TypeScript obliga a crear su template.
- **Cambiar textos:** todos están en [`src/modules/koth/templates/koth-messages.ts`](src/modules/koth/templates/koth-messages.ts).
- **Nuevo subcomando de `/koth`:** crea `commands/koth-<nombre>.command.ts` y añádelo en `koth.command.ts`.
- **Nueva modalidad de evento o funcionalidad:** crea `src/modules/<modulo>/` con su `*.module.ts` (implementa `BotModule`) y regístralo en `src/modules/index.ts`. Los nuevos cambios de esquema van en una nueva migración `00X-*.ts`.
