import { BitMask, BitMaskName } from "../mask/types";
import {
  BitConfig,
  BitComputedFn,
  BitErrors,
  BitFieldState,
  BitTransformFn,
  BitState,
  BitFieldDefinition,
  BitPath,
  BitPathValue,
  BitArrayPath,
  BitArrayItem,
  DeepPartial,
  BitFieldChangeMeta,
  BitFieldChangeEvent,
  BitBeforeValidateEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitAfterSubmitEvent,
} from "./types";
import type {
  BitHistoryMetadata,
  BitSelector,
  BitSelectorSubscriptionOptions,
  BitValidationOptions,
} from "./public-types";
import {
  BitResolvedConfig,
  BitStoreAdapter,
  BitValidationAdapter,
  BitLifecycleAdapter,
} from "./internal-types";
import { deepClone, deepEqual, getDeepValue, valueEqual } from "../utils";
import { normalizeConfig } from "./config";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager } from "./array-manager";
import { BitComputedManager } from "./computed-manager";
import { BitValidationManager } from "./validation-manager";
import { BitLifecycleManager } from "./lifecycle-manager";
import { BitDirtyManager } from "./dirty-manager";
import { BitScopeManager } from "./scope-manager";
import { BitFieldQueryManager } from "./field-query-manager";
import { BitErrorManager } from "./error-manager";
import { BitPersistManager } from "./persist-manager";
import { BitPluginManager } from "./plugin-manager";
import { createDevtoolsPlugin } from "./devtools-plugin";
import { BitSubscriptionEngine } from "./subscription-engine";
import { applyStateUpdate } from "./state-update-engine";
import { BitStoreEffectEngine } from "./effect-engine";
import { BitCapabilityRegistry } from "./capability-registry";
import type { BitLifecycleStorePort } from "./lifecycle-manager";
import type { BitValidationStorePort } from "./validation-manager";
/**
 * BitStore
 *
 * The core orchestrator of form state management.
 *
 * This store coordinates multiple managers to provide comprehensive form handling:
 * - Core managers handle essential state and validation
 * - Feature managers provide optional enhancements (history, arrays, scopes)
 * - Query/mutation managers organize domain-specific operations
 */
export class BitStore<T extends object = any>
  implements
    BitStoreAdapter<T>,
    BitValidationAdapter<T>,
    BitLifecycleAdapter<T>,
    BitValidationStorePort<T>,
    BitLifecycleStorePort<T>
{
  // ============================================================================
  // PRIVATE PROPERTIES
  // ============================================================================

  private state: BitState<T>;
  private readonly subscriptions: BitSubscriptionEngine<T>;
  private readonly effects: BitStoreEffectEngine<T>;
  private readonly capabilities: BitCapabilityRegistry<{
    validation: BitValidationManager<T>;
    lifecycle: BitLifecycleManager<T>;
    history: BitHistoryManager<T>;
    arrays: BitArrayManager<T>;
    scope: BitScopeManager<T>;
    query: BitFieldQueryManager<T>;
    error: BitErrorManager<T>;
  }>;

  // ============================================================================
  // PUBLIC PROPERTIES
  // ============================================================================

  public config: BitResolvedConfig<T>;
  public storeId: string;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Core Managers
  // Managers for essential form state management
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private readonly depsMg: BitDependencyManager<T>;
  private readonly computedMg: BitComputedManager<T>;
  private readonly dirtyMg: BitDirtyManager<T>;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Feature Managers
  // Managers for optional features like history, arrays, and scopes
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private get validation() {
    return this.capabilities.get("validation");
  }

  private get lifecycle() {
    return this.capabilities.get("lifecycle");
  }

  private get history() {
    return this.capabilities.get("history");
  }

  private get arrays() {
    return this.capabilities.get("arrays");
  }

  private get scope() {
    return this.capabilities.get("scope");
  }

  private get query() {
    return this.capabilities.get("query");
  }

  private get error() {
    return this.capabilities.get("error");
  }

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(config: BitConfig<T> = {}) {
    this.config = normalizeConfig(config);

    // Initialize core managers
    this.depsMg = new BitDependencyManager<T>();
    this.computedMg = new BitComputedManager<T>(() =>
      this.getComputedEntries(),
    );
    this.dirtyMg = new BitDirtyManager<T>();
    this.capabilities = new BitCapabilityRegistry<{
      validation: BitValidationManager<T>;
      lifecycle: BitLifecycleManager<T>;
      history: BitHistoryManager<T>;
      arrays: BitArrayManager<T>;
      scope: BitScopeManager<T>;
      query: BitFieldQueryManager<T>;
      error: BitErrorManager<T>;
    }>();

    const validationManager = new BitValidationManager<T>(this);
    const lifecycleManager = new BitLifecycleManager<T>(this);
    this.capabilities.register("validation", validationManager);
    this.capabilities.register("lifecycle", lifecycleManager);

    // Initialize feature managers
    const historyManager = new BitHistoryManager<T>(
      !!this.config.enableHistory,
      this.config.historyLimit ?? 15,
    );
    const arraysManager = new BitArrayManager<T>(this);

    // Initialize query/mutation managers with state access
    const scopeManager = new BitScopeManager<T>(
      () => this.state,
      () => this.config.initialValues,
      (scopeName) => this.getScopeFields(scopeName),
    );
    const queryManager = new BitFieldQueryManager<T>(
      this.depsMg,
      () => this.state,
      () => this.config,
    );
    const errorManager = new BitErrorManager<T>(
      () => this.state,
      (partial) => this.internalUpdateState(partial),
    );

    this.capabilities.register("history", historyManager);
    this.capabilities.register("arrays", arraysManager);
    this.capabilities.register("scope", scopeManager);
    this.capabilities.register("query", queryManager);
    this.capabilities.register("error", errorManager);
    const persistManager = new BitPersistManager<T>(
      this.config.persist,
      () => this.state.values,
      () => this.getDirtyValues(),
      (values) => this.applyPersistedValues(values),
    );

    // Initialize form state
    const initialValues = deepClone(this.config.initialValues);

    // Register initial fields from config
    if (this.config.fields) {
      Object.entries(this.config.fields).forEach(([path, fieldConfig]) => {
        this.depsMg.register(
          path,
          fieldConfig as BitFieldDefinition<T>,
          initialValues,
        );
      });
    }

    const valuesWithComputeds = this.computedMg.apply(initialValues);

    this.state = {
      values: valuesWithComputeds,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };
    this.subscriptions = new BitSubscriptionEngine<T>(() => this.state);

    this.internalSaveSnapshot();

    this.storeId =
      config.storeId ||
      this.config.name ||
      `bit-form-${Math.random().toString(36).substring(2, 9)}`;

    const runtimePlugins = [...this.config.plugins];
    const devtoolsPlugin = createDevtoolsPlugin<T>(this.config.devTools);
    if (devtoolsPlugin) {
      runtimePlugins.push(devtoolsPlugin);
    }

    const pluginManager = new BitPluginManager<T>(runtimePlugins, () => ({
      storeId: this.storeId,
      getState: () => this.getState(),
      getConfig: () => this.getConfig(),
    }));

    this.effects = new BitStoreEffectEngine<T>(
      this.storeId,
      this,
      persistManager,
      pluginManager,
    );
    this.effects.initialize();
  }

  // ============================================================================
  // STATE ACCESS
  // ============================================================================

  getConfig() {
    return this.config;
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return (
      this.depsMg.fieldConfigs.get(path) ||
      this.config.fields?.[path as keyof typeof this.config.fields]
    );
  }

  getScopeFields(scopeName: string): string[] {
    const result: string[] = [];

    this.depsMg.fieldConfigs.forEach((cfg, path) => {
      if (cfg.scope === scopeName) {
        result.push(path);
      }
    });

    return result;
  }

  getComputedEntries(): [string, BitComputedFn<T>][] {
    const result: [string, BitComputedFn<T>][] = [];

    this.depsMg.fieldConfigs.forEach((cfg, path) => {
      if (cfg.computed) {
        result.push([path, cfg.computed]);
      }
    });

    return result;
  }

  getTransformEntries(): [string, BitTransformFn<T>][] {
    const result: [string, BitTransformFn<T>][] = [];

    this.depsMg.fieldConfigs.forEach((cfg, path) => {
      if (cfg.transform) {
        result.push([path, cfg.transform]);
      }
    });

    return result;
  }

  resolveMask(path: string): BitMask | undefined {
    const maskOption = this.getFieldConfig(path)?.mask;
    if (!maskOption) return undefined;

    if (typeof maskOption === "string") {
      return this.config.masks?.[maskOption];
    }

    return maskOption;
  }

  getState(): BitState<T> {
    return this.state;
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    const value = getDeepValue(
      this.state.values,
      path as string,
    ) as BitPathValue<T, P>;

    return {
      value,
      error: this.state.errors[path as keyof BitErrors<T>],
      touched: !!this.state.touched[path as keyof typeof this.state.touched],
      isHidden: this.isHidden(path),
      isRequired: this.isRequired(path),
      isDirty: this.isFieldDirty(path as string),
      isValidating: this.isFieldValidating(path as string),
    };
  }

  get isValid(): boolean {
    return this.state.isValid;
  }

  get isSubmitting(): boolean {
    return this.state.isSubmitting;
  }

  get isDirty(): boolean {
    return this.state.isDirty;
  }

  // ============================================================================
  // FIELD REGISTRATION & CLEANUP
  // ============================================================================

  registerField(path: string, config: BitFieldDefinition<T>) {
    this.depsMg.register(path, config, this.state.values);
    if (this.depsMg.isHidden(path)) {
      this.subscriptions.notify(this.state, ["*"]);
    }
  }

  unregisterField<P extends BitPath<T>>(path: P) {
    // Fields from initial config are never unregistered
    if (this.config.fields?.[path as string]) {
      return;
    }
    this.depsMg.unregister(path);

    const newErrors = { ...this.state.errors };
    const newTouched = { ...this.state.touched };
    let stateChanged = false;

    if (newErrors[path as keyof BitErrors<T>]) {
      delete newErrors[path as keyof BitErrors<T>];
      stateChanged = true;
    }

    if (newTouched[path as keyof typeof newTouched]) {
      delete newTouched[path as keyof typeof newTouched];
      stateChanged = true;
    }

    if (stateChanged) {
      this.internalUpdateState({
        errors: newErrors,
        touched: newTouched,
      });
    }
  }

  unregisterPrefix(prefix: string) {
    this.depsMg.unregisterPrefix(prefix);
  }

  // ============================================================================
  // FIELD QUERIES (Delegated to queryMg)
  // ============================================================================

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.query.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.query.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.query.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.query.isFieldValidating(path);
  }

  // ============================================================================
  // SUBSCRIPTIONS & WATCHERS
  // ============================================================================

  subscribe(listener: () => void): () => void {
    return this.subscriptions.subscribe(listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ) {
    const equalityFn = options?.equalityFn ?? valueEqual;
    return this.subscriptions.subscribeSelector(
      selector,
      listener,
      options,
      equalityFn,
    );
  }

  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ) {
    const mergedPaths = [...(options?.paths ?? []), path as string];

    return this.subscribeSelector(
      (state) =>
        getDeepValue(state.values, path as string) as BitPathValue<T, P>,
      listener,
      {
        ...options,
        paths: mergedPaths,
      },
    );
  }

  watch<P extends BitPath<T>>(
    path: P,
    callback: (value: BitPathValue<T, P>) => void,
  ) {
    return this.subscribePath(path, callback, {
      equalityFn: deepEqual,
    });
  }

  // ============================================================================
  // FIELD VALUE MUTATIONS
  // ============================================================================

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  setFieldWithMeta(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this.lifecycle.updateField(path, value, meta);
  }

  blurField<P extends BitPath<T>>(path: P) {
    this.internalSaveSnapshot();

    if (!this.state.touched[path as keyof typeof this.state.touched]) {
      this.internalUpdateState({
        touched: { ...this.state.touched, [path]: true },
      });
    }

    this.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    const newTouched = { ...this.state.touched };
    paths.forEach((path) => (newTouched[path] = true));
    this.internalUpdateState({ touched: newTouched });
  }

  replaceValues(newValues: T) {
    this.lifecycle.replaceValues(newValues);
  }

  hydrate(values: DeepPartial<T>) {
    this.lifecycle.hydrateValues(values);
  }

  rebase(newValues: T) {
    this.lifecycle.rebaseValues(newValues);
  }

  // ============================================================================
  // ERROR MANAGEMENT (Delegated to errorMg)
  // ============================================================================

  setError(path: string, message: string | undefined) {
    this.error.setError(path, message);
  }

  setErrors(errors: BitErrors<T>) {
    this.error.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    this.error.setServerErrors(serverErrors);
  }

  // ============================================================================
  // FORM-LEVEL OPERATIONS
  // ============================================================================

  reset() {
    this.lifecycle.reset();
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    return this.lifecycle.submit(onSuccess);
  }

  registerMask(name: BitMaskName, mask: BitMask) {
    this.config.masks = {
      ...(this.config.masks || {}),
      [name]: mask,
    };
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyMg.buildDirtyValues(this.state.values);
  }

  async restorePersisted(): Promise<boolean> {
    return this.effects.restorePersisted();
  }

  async forceSave(): Promise<void> {
    await this.effects.savePersistedNow();
  }

  async clearPersisted(): Promise<void> {
    await this.effects.clearPersisted();
  }

  // ============================================================================
  // ARRAY OPERATIONS (Delegated to arraysMg)
  // ============================================================================

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arrays.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arrays.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arrays.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number) {
    this.arrays.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ) {
    this.arrays.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number) {
    this.arrays.moveItem(path, from, to);
  }

  // ============================================================================
  // HISTORY & TIME-TRAVEL (Delegated to historyMg)
  // ============================================================================

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  undo() {
    const prevState = this.history.undo();
    if (prevState) {
      const isDirty = this.dirtyMg.rebuild(
        prevState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: prevState, isDirty });
      this.validation.validate();
    }
  }

  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      const isDirty = this.dirtyMg.rebuild(
        nextState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: nextState, isDirty });
      this.validation.validate();
    }
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return this.history.getMetadata();
  }

  // ============================================================================
  // VALIDATION & SCOPES
  // ============================================================================

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.validation.validate(options);
  }

  emitBeforeValidate(event: BitBeforeValidateEvent<T>): Promise<void> {
    return this.effects.beforeValidate(event);
  }

  emitAfterValidate(event: BitAfterValidateEvent<T>): Promise<void> {
    return this.effects.afterValidate(event);
  }

  emitBeforeSubmit(event: BitBeforeSubmitEvent<T>): Promise<void> {
    return this.effects.beforeSubmit(event);
  }

  emitAfterSubmit(event: BitAfterSubmitEvent<T>): Promise<void> {
    return this.effects.afterSubmit(event);
  }

  emitFieldChange(event: BitFieldChangeEvent<T>) {
    this.effects.onFieldChange(event);
  }

  emitOperationalError(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) {
    return this.effects.reportOperationalError(event);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.validation.hasValidationsInProgress(scopeFields);
  }

  triggerValidation(scopeFields?: string[]) {
    this.validation.trigger(scopeFields);
  }

  getStepStatus(scopeName: string) {
    return this.scope.getStepStatus(scopeName);
  }

  getStepErrors(scopeName: string): Record<string, string> {
    return this.scope.getStepErrors(scopeName);
  }

  updateDependencies(changedPath: string, newValues: T): string[] {
    return this.depsMg.updateDependencies(changedPath, newValues);
  }

  isFieldHidden(path: string): boolean {
    return this.depsMg.isHidden(path);
  }

  evaluateAllDependencies(values: T): void {
    this.depsMg.evaluateAll(values);
  }

  getHiddenFields(): string[] {
    return Array.from(this.depsMg.hiddenFields);
  }

  getRequiredErrors(values: T): BitErrors<T> {
    return this.depsMg.getRequiredErrors(values);
  }

  clearFieldValidation(path: string): void {
    this.validation.clear(path);
  }

  handleFieldAsyncValidation(path: string, value: any): void {
    this.validation.handleAsync(path, value);
  }

  cancelAllValidations(): void {
    this.validation.cancelAll();
  }

  validateNow(options?: BitValidationOptions): Promise<boolean> {
    return this.validation.validate(options);
  }

  updateDirtyForPath(path: string, nextValues: T, baselineValues: T): boolean {
    return this.dirtyMg.updateForPath(path, nextValues, baselineValues);
  }

  rebuildDirtyState(nextValues: T, baselineValues: T): boolean {
    return this.dirtyMg.rebuild(nextValues, baselineValues);
  }

  clearDirtyState(): void {
    this.dirtyMg.clear();
  }

  buildDirtyValues(values: T): Partial<T> {
    return this.dirtyMg.buildDirtyValues(values);
  }

  resetHistory(initialValues: T): void {
    this.history.reset(initialValues);
  }

  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================

  internalUpdateState(
    partialState: Partial<BitState<T>>,
    changedPaths?: string[],
  ) {
    const updateResult = applyStateUpdate({
      currentState: this.state,
      partialState,
      changedPaths,
      applyComputedValues: (values) => this.computedMg.apply(values),
    });

    this.state = updateResult.nextState;

    this.subscriptions.notify(this.state, updateResult.changedPaths);
    this.effects.onStateUpdated(this.state, updateResult.valuesChanged);
  }

  internalSaveSnapshot() {
    this.history.saveSnapshot(this.state.values);
  }

  private applyPersistedValues(values: Partial<T>) {
    const nextValues = deepClone({
      ...this.config.initialValues,
      ...values,
    } as T);

    this.validation.cancelAll();
    this.depsMg.evaluateAll(nextValues);

    const isDirty = this.dirtyMg.rebuild(nextValues, this.config.initialValues);

    this.internalUpdateState({
      values: nextValues,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty,
      isSubmitting: false,
    });

    this.internalSaveSnapshot();
    this.validation.validate();
  }

  cleanup() {
    this.subscriptions.destroy();
    this.validation.cancelAll();
    this.capabilities.clear();
    this.effects.destroy();
  }
}
