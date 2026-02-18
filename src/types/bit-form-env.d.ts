export {};

declare global {
  var __BIT_FORM__:
    | {
        stores: Record<string, any>;
        listeners: Set<Function>;
        dispatch: (storeId: string, state: any) => void;
        subscribe: (
          listener: (storeId: string, state: any) => void,
        ) => () => void;
      }
    | undefined;
}
