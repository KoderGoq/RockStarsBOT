export function toDiscordTimestamp(date, style) {
    return `<t:${Math.floor(date.toSeconds())}:${style}>`;
}
//# sourceMappingURL=discord-timestamp.js.map