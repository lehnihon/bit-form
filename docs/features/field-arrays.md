# Field Arrays

Managing lists of inputs (like adding multiple emails or a list of skills) is notoriously hard. Bit-Form handles array operations natively and efficiently.

## The Array Manager

Instead of mutating the array directly, you should use the array methods provided by Bit-Form. These are available on the `BitStore` instance and automatically exported by hooks like `useBitFieldArray`.

### Methods

- `pushItem(path, value)`: Adds an item to the end.
- `prependItem(path, value)`: Adds an item to the beginning.
- `insertItem(path, index, value)`: Inserts an item at a specific index.
- `removeItem(path, index)`: Removes the item.
- `moveItem(path, fromIndex, toIndex)`: Moves an item to a new position.
- `swapItems(path, indexA, indexB)`: Swaps the positions of two items.

## Smart Error Reallocation

One of the most complex parts of field arrays is validation. If you have an error on `items.2.name` and you delete the item at index `0`, the item that was at index `2` shifts to index `1`.

Bit-Form's engine **automatically detects array mutations and shifts, swaps, or moves validation errors accordingly**. You never have to worry about mismatched error messages after dragging, dropping, or removing list items.

## Example (Framework Hook)

If you are using React or Vue, the framework-specific `useBitFieldArray` handles unique key generation for you to prevent rendering bugs.

```tsx
const { fields, append, remove, move } = useBitFieldArray("skills");

// fields = [{ key: 'xyz123', value: 'React', index: 0 }, ...]
```
