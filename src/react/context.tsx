import React, { createContext, useContext } from "react";
import type { BitFrameworkStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

const BitContext = createContext<BitFrameworkStoreApi<any> | null>(null);

export const BitFormProvider = ({
  store,
  children,
}: {
  store: unknown;
  children: React.ReactNode;
}) => (
  <BitContext.Provider value={createFrameworkStoreAdapter(store)}>
    {children}
  </BitContext.Provider>
);

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store)
    throw new Error(
      "BitForm hooks devem ser usados dentro de um BitFormProvider",
    );
  return store as BitFrameworkStoreApi<T>;
};
