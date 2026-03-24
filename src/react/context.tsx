import React, { createContext, useContext } from "react";
import type { BitFormBindingApi, BitStoreHooksApi } from "../core";
import { resolveBitStoreForHooks } from "../core";

const BitContext = createContext<BitFormBindingApi<any> | null>(null);

export const BitFormProvider = ({
  store,
  children,
}: {
  store: BitStoreHooksApi<any>;
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
  return store as BitFormBindingApi<T>;
};
