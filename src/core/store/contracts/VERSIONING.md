# Internal Contract Versioning

This document defines how internal Core contracts evolve without breaking public API stability.

## Public vs Internal

- Public API (`createBitStore`, `read/observe/write/feature`) follows strict semver compatibility.
- Internal ports under `core/store/contracts` can evolve incrementally when adapters preserve runtime behavior.

## Current Direction

- Validation contracts were split into focused ports:
  - `BitValidationStatePort`
  - `BitValidationFieldPort`
  - `BitValidationEffectsPort`
  - `BitValidationPipelinePort`
- `BitValidationEffectsPort` intentionally does not expose `validate`, keeping side effects minimal.

## Evolution Rules

1. Prefer additive changes in internal ports.
2. If removal is needed, migrate call sites first and preserve behavior through manager-level orchestration.
3. Keep orchestration explicit (`...-orchestrator.ts`) when a manager starts to accumulate multiple concerns.
4. Add architecture-boundary tests whenever an internal contract is reduced or split.

## Validation Checklist for Internal Contract Changes

1. Contract compiles without widening dependencies.
2. Manager tests pass for updated constructor ports.
3. Architecture boundary tests assert the intended contract surface.
4. No public API signature change is introduced.
