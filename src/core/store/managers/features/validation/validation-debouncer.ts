import type { BitValidationTriggerOptions } from "../../../contracts/port-types";
import type { BitValidationOptions } from "../../../contracts/public/meta-types";

export interface BitValidationDebouncerPort {
  schedule(fn: () => void, delayMs: number): () => void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  readonly validationDelay: number;
}

/**
 * Responsável exclusivamente pelo debounce do trigger de validação.
 * Acumula campos pendentes dentro da janela de debounce, evitando
 * descartar paths de chamadas anteriores dentro do mesmo intervalo.
 */
export class BitValidationDebouncer {
  private cancelTimeout?: () => void;
  private pendingScopeFields: Set<string> | null = null;

  constructor(private readonly port: BitValidationDebouncerPort) {}

  trigger(scopeFields?: string[], options?: BitValidationTriggerOptions): void {
    if (this.cancelTimeout) {
      this.cancelTimeout();
      this.cancelTimeout = undefined;
    }

    const configuredDelay = this.port.validationDelay ?? 300;
    const delay = options?.forceDebounce
      ? Math.max(1, configuredDelay)
      : configuredDelay;

    if (delay > 0) {
      // Acumula paths em vez de substituir — garante que paths de calls
      // anteriores dentro do mesmo debounce não sejam descartados.
      if (scopeFields && scopeFields.length > 0) {
        if (!this.pendingScopeFields) {
          this.pendingScopeFields = new Set(scopeFields);
        } else {
          for (const f of scopeFields) this.pendingScopeFields.add(f);
        }
      } else {
        // Sem scope = validação global, descarta paths acumulados
        this.pendingScopeFields = null;
      }

      this.cancelTimeout = this.port.schedule(() => {
        // Lê pendingScopeFields aqui — captura todos os campos acumulados
        // dentro da janela de debounce, inclusive os adicionados por trigger()
        // chamados após este agendamento.
        const resolvedScopeFields = this.pendingScopeFields
          ? Array.from(this.pendingScopeFields)
          : undefined;
        this.pendingScopeFields = null;
        this.cancelTimeout = undefined;
        void this.validateWithOptionalScopeFields(resolvedScopeFields);
      }, delay);
    } else {
      this.pendingScopeFields = null;
      void this.validateWithOptionalScopeFields(scopeFields);
    }
  }

  private validateWithOptionalScopeFields(scopeFields?: string[]) {
    if (scopeFields && scopeFields.length > 0) {
      return this.port.validate({ scopeFields });
    }

    return this.port.validate();
  }

  cancelPending(): void {
    if (this.cancelTimeout) {
      this.cancelTimeout();
      this.cancelTimeout = undefined;
    }
    this.pendingScopeFields = null;
  }
}
