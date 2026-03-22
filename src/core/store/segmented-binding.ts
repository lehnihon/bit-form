import type {
  BitFormBindingApi,
  BitStoreVNextApi,
} from "./contracts/public-types";

type BitStoreLike<T extends object> = BitFormBindingApi<T> &
  Partial<BitStoreVNextApi<T>>;

export type BitSegmentedBinding<T extends object> = {
  query: {
    config: Readonly<BitFormBindingApi<T>["config"]>;
    getState: BitFormBindingApi<T>["getState"];
    getDirtyValues: BitFormBindingApi<T>["getDirtyValues"];
  };
  write: {
    setField: BitFormBindingApi<T>["setField"];
    blurField: BitFormBindingApi<T>["blurField"];
    setValues: BitFormBindingApi<T>["setValues"];
    setError: BitFormBindingApi<T>["setError"];
    setErrors: BitFormBindingApi<T>["setErrors"];
    setServerErrors: BitFormBindingApi<T>["setServerErrors"];
    validate: BitFormBindingApi<T>["validate"];
    transaction: BitFormBindingApi<T>["transaction"];
    submit: BitFormBindingApi<T>["submit"];
    reset: BitFormBindingApi<T>["reset"];
  };
  observe: {
    subscribeFormMeta: BitFormBindingApi<T>["subscribeFormMeta"];
    subscribeFieldState: BitFormBindingApi<T>["subscribeFieldState"];
    subscribe: BitFormBindingApi<T>["subscribe"];
    subscribePath: BitFormBindingApi<T>["subscribePath"];
    subscribeSelector: BitFormBindingApi<T>["subscribeSelector"];
    subscribeTracked: BitFormBindingApi<T>["subscribeTracked"];
  };
  features: {
    pushItem: BitFormBindingApi<T>["pushItem"];
    prependItem: BitFormBindingApi<T>["prependItem"];
    insertItem: BitFormBindingApi<T>["insertItem"];
    removeItem: BitFormBindingApi<T>["removeItem"];
    moveItem: BitFormBindingApi<T>["moveItem"];
    swapItems: BitFormBindingApi<T>["swapItems"];
    resolveMask: BitFormBindingApi<T>["resolveMask"];
  };
};

const segmentedBindingCache = new WeakMap<object, BitSegmentedBinding<any>>();

function hasSegmentedShape<T extends object>(
  store: BitStoreLike<T>,
): store is BitStoreLike<T> & BitStoreVNextApi<T> {
  return !!store.query && !!store.write && !!store.observe && !!store.features;
}

export function resolveSegmentedBinding<T extends object>(
  store: BitStoreLike<T>,
): BitSegmentedBinding<T> {
  const cached = segmentedBindingCache.get(store as object);
  if (cached) {
    return cached as BitSegmentedBinding<T>;
  }

  if (hasSegmentedShape(store)) {
    const segmentedFromVNext: BitSegmentedBinding<T> = {
      query: {
        config: store.config,
        getState: () => store.query.getState(),
        getDirtyValues: () => store.query.getDirtyValues(),
      },
      write: {
        setField: (path, value) => store.write.setField(path, value),
        blurField: (path) => store.write.blurField(path),
        setValues: (values, options) => store.write.setValues(values, options),
        setError: (path, message) => store.write.setError(path, message),
        setErrors: (errors) => store.write.setErrors(errors),
        setServerErrors: (errors) => store.write.setServerErrors(errors),
        validate: (options) => store.write.validate(options),
        transaction: (callback) => store.write.transaction(callback),
        submit: (onSuccess) => store.write.submit(onSuccess),
        reset: () => store.write.reset(),
      },
      observe: {
        subscribeFormMeta: (listener) =>
          store.observe.subscribeFormMeta(listener),
        subscribeFieldState: (path, listener) =>
          store.observe.subscribeFieldState(path, listener),
        subscribe: (listener) => store.observe.subscribe(listener),
        subscribePath: (path, listener, options) =>
          store.observe.subscribePath(path, listener, options),
        subscribeSelector: (selector, listener, options) =>
          store.observe.subscribeSelector(selector, listener, options),
        subscribeTracked: (selector, listener, options) =>
          store.observe.subscribeTracked(selector, listener, options),
      },
      features: {
        pushItem: (path, value) => store.features.pushItem(path, value),
        prependItem: (path, value) => store.features.prependItem(path, value),
        insertItem: (path, index, value) =>
          store.features.insertItem(path, index, value),
        removeItem: (path, index) => store.features.removeItem(path, index),
        moveItem: (path, from, to) => store.features.moveItem(path, from, to),
        swapItems: (path, indexA, indexB) =>
          store.features.swapItems(path, indexA, indexB),
        resolveMask: (path) => store.features.resolveMask(path),
      },
    };

    segmentedBindingCache.set(store as object, segmentedFromVNext);
    return segmentedFromVNext;
  }

  const segmented: BitSegmentedBinding<T> = {
    query: {
      config: store.config,
      getState: () => store.getState(),
      getDirtyValues: () => store.getDirtyValues(),
    },
    write: {
      setField: (path, value) => store.setField(path, value),
      blurField: (path) => store.blurField(path),
      setValues: (values, options) => store.setValues(values, options),
      setError: (path, message) => store.setError(path, message),
      setErrors: (errors) => store.setErrors(errors),
      setServerErrors: (errors) => store.setServerErrors(errors),
      validate: (options) => store.validate(options),
      transaction: (callback) => store.transaction(callback),
      submit: (onSuccess) => store.submit(onSuccess),
      reset: () => store.reset(),
    },
    observe: {
      subscribeFormMeta: (listener) => store.subscribeFormMeta(listener),
      subscribeFieldState: (path, listener) =>
        store.subscribeFieldState(path, listener),
      subscribe: (listener) => store.subscribe(listener),
      subscribePath: (path, listener, options) =>
        store.subscribePath(path, listener, options),
      subscribeSelector: (selector, listener, options) =>
        store.subscribeSelector(selector, listener, options),
      subscribeTracked: (selector, listener, options) =>
        store.subscribeTracked(selector, listener, options),
    },
    features: {
      pushItem: (path, value) => store.pushItem(path, value),
      prependItem: (path, value) => store.prependItem(path, value),
      insertItem: (path, index, value) => store.insertItem(path, index, value),
      removeItem: (path, index) => store.removeItem(path, index),
      moveItem: (path, from, to) => store.moveItem(path, from, to),
      swapItems: (path, indexA, indexB) =>
        store.swapItems(path, indexA, indexB),
      resolveMask: (path) => store.resolveMask(path),
    },
  };

  segmentedBindingCache.set(store as object, segmented);
  return segmented;
}
