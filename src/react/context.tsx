import React, { createContext, useContext } from "react";
import type { BitFrameworkStore } from "../core";

const BitContext = createContext<BitFrameworkStore<any> | null>(null);

export const BitFormProvider = ({
  store,
  children,
}: {
  store: BitFrameworkStore<any>;
  children: React.ReactNode;
}) => <BitContext.Provider value={store}>{children}</BitContext.Provider>;

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store)
    throw new Error(
      "BitForm hooks devem ser usados dentro de um BitFormProvider",
    );
  return store as BitFrameworkStore<T>;
};
