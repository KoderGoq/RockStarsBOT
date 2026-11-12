/** Lectores tipados de columnas: fallan de forma explícita si el esquema no coincide. */
export function readString(row, column) {
    const value = row[column];
    if (typeof value !== 'string') {
        throw new TypeError(`La columna "${column}" debería ser TEXT y es ${describe(value)}`);
    }
    return value;
}
export function readNullableString(row, column) {
    const value = row[column];
    return value === null ? null : readString(row, column);
}
export function readNumber(row, column) {
    const value = row[column];
    if (typeof value === 'bigint')
        return Number(value);
    if (typeof value !== 'number') {
        throw new TypeError(`La columna "${column}" debería ser INTEGER y es ${describe(value)}`);
    }
    return value;
}
function describe(value) {
    if (value === undefined)
        return 'inexistente';
    if (value === null)
        return 'NULL';
    return typeof value;
}
//# sourceMappingURL=row-readers.js.map