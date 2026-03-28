import { isPathWithinPrefix } from "../../../shared/path-prefix";

export class BitValidationCoordinator {
  private currentValidationId = 0;
  private readonly immediateAbortControllers = new Map<
    string,
    AbortController
  >();

  beginValidation(): number {
    this.currentValidationId += 1;
    return this.currentValidationId;
  }

  getCurrentValidationId(): number {
    return this.currentValidationId;
  }

  isValidationCurrent(validationId: number): boolean {
    return validationId === this.currentValidationId;
  }

  setImmediateController(path: string, controller: AbortController): void {
    this.immediateAbortControllers.set(path, controller);
  }

  clearImmediateController(path: string): void {
    this.immediateAbortControllers.delete(path);
  }

  cancelImmediate(path: string): void {
    const controller = this.immediateAbortControllers.get(path);
    if (!controller) {
      return;
    }

    controller.abort();
    this.immediateAbortControllers.delete(path);
  }

  cancelImmediatePrefix(
    prefix: string,
    onPathCancelled: (path: string) => void,
  ) {
    for (const path of this.immediateAbortControllers.keys()) {
      if (!isPathWithinPrefix(path, prefix)) {
        continue;
      }

      this.cancelImmediate(path);
      onPathCancelled(path);
    }
  }

  cancelAllImmediate(): void {
    this.immediateAbortControllers.forEach((controller) => {
      controller.abort();
    });
    this.immediateAbortControllers.clear();
  }
}
