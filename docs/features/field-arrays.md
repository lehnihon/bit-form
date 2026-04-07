# Field Arrays

Managing lists of inputs (like adding multiple emails or a list of skills) is notoriously hard. Bit-Form handles array operations natively and efficiently.

## The Array Manager

Instead of mutating the array directly, you should use the array methods provided by Bit-Form. These are available on the `BitStore` instance and automatically exported by hooks like `useBitArray`.

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

If you are using React or Vue, the framework-specific `useBitArray` handles unique key generation for you to prevent rendering bugs.

```tsx
const { fields, append, remove, move } = useBitArray("skills");

// fields = [{ key: 'xyz123', value: 'React', index: 0 }, ...]
```

## End-to-End Example (React)

```tsx
import { useBitArray, useBitField } from "@lehnihon/bit-form/react";

type SkillItem = { name: string; years: number };

export function SkillsEditor() {
  const skills = useBitArray<SkillItem>("skills");
  const title = useBitField("title");

  return (
    <section>
      <label>
        Profile title
        <input {...title.props} />
      </label>

      <button
        type="button"
        onClick={() => skills.append({ name: "", years: 0 })}
      >
        Add skill
      </button>

      {skills.fields.map((row) => (
        <div key={row.key}>
          <input
            value={String(row.value?.name ?? "")}
            onChange={(e) =>
              skills.update(row.index, {
                ...(row.value ?? { name: "", years: 0 }),
                name: e.target.value,
              })
            }
            placeholder="Skill name"
          />

          <input
            type="number"
            value={Number(row.value?.years ?? 0)}
            onChange={(e) =>
              skills.update(row.index, {
                ...(row.value ?? { name: "", years: 0 }),
                years: Number(e.target.value || 0),
              })
            }
          />

          <button type="button" onClick={() => skills.remove(row.index)}>
            Remove
          </button>

          <button
            type="button"
            onClick={() =>
              row.index > 0 && skills.move(row.index, row.index - 1)
            }
          >
            Move up
          </button>
        </div>
      ))}
    </section>
  );
}
```

## Error Reallocation Example

If `skills.2.name` has an error and you remove `skills.0`, Bit-Form shifts the error path to `skills.1.name` automatically.

This is especially important for drag-and-drop UIs where item indexes change frequently.

## Common Mistakes

| Wrong                               | Correct                                      | Why                                     |
| ----------------------------------- | -------------------------------------------- | --------------------------------------- |
| Mutating array directly in UI state | Use `append/remove/move/swap/update` helpers | Keeps store metadata and errors in sync |
| Rendering rows with index as key    | Use `row.key` from `useBitArray`             | Prevents rendering glitches on reorder  |
| Manually remapping error paths      | Let array manager handle reallocation        | Avoids path drift and stale errors      |

## Testing Array Reorder

```ts
import { createBitStore } from "@lehnihon/bit-form";
import { describe, expect, it } from "vitest";

describe("array move", () => {
  it("moves item from index 2 to index 0", () => {
    const store = createBitStore({
      initialValues: {
        skills: [{ name: "A" }, { name: "B" }, { name: "C" }],
      },
    });

    store.feature.moveItem("skills", 2, 0);
    expect(store.read.getValue("skills.0.name")).toBe("C");
  });
});
```

## Related

- [Array Reorder Example](../examples/array-reorder-example.md)
- [Testing Guide](../guides/testing.md)
