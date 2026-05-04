import React, { createContext, useContext, useMemo } from "react";
import type { BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

const BitContext = createContext<BitFrameworkStoreApi<any> | null>(null);

interface BitFormProviderProps<T extends object> {
  store: BitFrameworkStoreApi<T> | BitStoreApi<T>;
  children: React.ReactNode;
}

interface BitFormProviderRuntimeProps {
  store: unknown;
  children: React.ReactNode;
}

type BitFormProviderComponent = {
  <T extends object>(props: BitFormProviderProps<T>): React.ReactElement;
  (props: BitFormProviderRuntimeProps): React.ReactElement;
};

export const BitFormProvider: BitFormProviderComponent = ({
  store,
  children,
}: BitFormProviderRuntimeProps) => {
  const adapted = useMemo(() => createFrameworkStoreAdapter(store), [store]);

  return (
    <BitContext.Provider value={adapted}>
      {children}
    </BitContext.Provider>
  );
};

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store)
    throw new Error(
      "BitForm hooks devem ser usados dentro de um BitFormProvider",
    );
  return store as BitFrameworkStoreApi<T>;
};
