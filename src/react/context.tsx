import React, { createContext, useContext } from "react";
import type { BitStoreApi } from "../core";

const BitContext = createContext<BitStoreApi<any> | null>(null);

export const BitFormProvider = ({
  store,
  children,
}: {
  store: BitStoreApi<any>;
  children: React.ReactNode;
}) => <BitContext.Provider value={store}>{children}</BitContext.Provider>;

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store)
    throw new Error(
      "BitForm hooks devem ser usados dentro de um BitFormProvider",
    );
  return store as BitStoreApi<T>;
};
