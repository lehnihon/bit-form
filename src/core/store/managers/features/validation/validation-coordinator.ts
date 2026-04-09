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

  clearImmediateController(path: string, controller: AbortController): boolean {
    if (this.immediateAbortControllers.get(path) === controller) {
      this.immediateAbortControllers.delete(path);
      return true;
    }

    return false;
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

  remapImmediateControllers(remapPath: (path: string) => string | null): void {
    const nextControllers = new Map<string, AbortController>();

    for (const [path, controller] of this.immediateAbortControllers.entries()) {
      const nextPath = remapPath(path);

      if (!nextPath) {
        controller.abort();
        continue;
      }

      nextControllers.set(nextPath, controller);
    }

    this.immediateAbortControllers.clear();
    nextControllers.forEach((controller, path) => {
      this.immediateAbortControllers.set(path, controller);
    });
  }

  cancelAllImmediate(): void {
    this.immediateAbortControllers.forEach((controller) => {
      controller.abort();
    });
    this.immediateAbortControllers.clear();
  }
}
