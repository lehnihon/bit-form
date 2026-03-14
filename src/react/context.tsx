import React, { createContext, useContext } from "react";
import type { BitStoreApi } from "../core";
import type { BitStoreHooksApi } from "../core/store/public-types";
import { resolveBitStoreForHooks } from "../core/store/create-store";

const BitContext = createContext<BitStoreHooksApi<any> | null>(null);

export const BitFormProvider = ({
  store,
  children,
}: {
  store: BitStoreApi<any>;
  children: React.ReactNode;
}) => (
  <BitContext.Provider value={resolveBitStoreForHooks(store)}>
    {children}
  </BitContext.Provider>
);

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store)
    throw new Error(
      "BitForm hooks devem ser usados dentro de um BitFormProvider",
    );
  return store as BitStoreHooksApi<T>;
};
