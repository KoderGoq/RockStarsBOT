export interface Migration {
  /** Número de versión creciente. Nunca reutilices ni modifiques una migración publicada. */
  readonly version: number;
  readonly name: string;
  readonly up: string;
}
