import type {
  BitArrayItem,
  BitArrayPath,
  BitPathValue,
} from "../store/contracts/types";

export interface BitArrayBindingField<TItem> {
  key: string;
  value: TItem;
  index: number;
}

export interface BitArrayBinding<
  TForm extends object,
  P extends BitArrayPath<TForm>,
> {
  readItems(): BitArrayItem<BitPathValue<TForm, P>>[];
  getFields(
    items: BitArrayItem<BitPathValue<TForm, P>>[],
  ): BitArrayBindingField<BitArrayItem<BitPathValue<TForm, P>>>[];
  append(value: BitArrayItem<BitPathValue<TForm, P>>): void;
  prepend(value: BitArrayItem<BitPathValue<TForm, P>>): void;
  insert(index: number, value: BitArrayItem<BitPathValue<TForm, P>>): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  swap(indexA: number, indexB: number): void;
  replace(items: BitArrayItem<BitPathValue<TForm, P>>[]): void;
  clear(): void;
}
