import React, { createContext, useContext } from 'react';
import { BitStore } from '../core/bit-store';

const BitContext = createContext<BitStore<any> | null>(null);

export const BitFormProvider = ({ store, children }: { store: BitStore<any>; children: React.ReactNode }) => (
  <BitContext.Provider value={store}>{children}</BitContext.Provider>
);

export const useBitStore = <T extends object>() => {
  const store = useContext(BitContext);
  if (!store) throw new Error('BitForm hooks devem ser usados dentro de um BitFormProvider');
  return store as BitStore<T>;
};