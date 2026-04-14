import React, { createContext, useContext } from "react";
import type { BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

const BitContext = createContext<BitFrameworkStoreApi<any> | null>(null);

interface BitFormProviderProps<T extends object> {
  store: BitFrameworkStoreApi<T> | BitStoreApi<T>;
  children: React.ReactNode;
}

export function BitFormProvider<T extends object>({
  store,
  children,
}: BitFormProviderProps<T>) {
  return (
    <BitContext.Provider value={createFrameworkStoreAdapter<T>(store)}>
      {children}
    </BitContext.Provider>
  );
}

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store)
    throw new Error(
      "BitForm hooks devem ser usados dentro de um BitFormProvider",
    );
  return store as BitFrameworkStoreApi<T>;
};
