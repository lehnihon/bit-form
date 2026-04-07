# Array Reorder + Error Shift Example

## Scenario

A profile form allows users to reorder skills. Validation errors must remain attached to the correct skill after reorder/remove operations.

## Goal

Demonstrate stable row keys, reorder operations, and automatic error path reallocation.

## Store Setup

```tsx
import { createBitStore } from "@lehnihon/bit-form";

type Skill = { name: string; years: number };

type ProfileForm = {
  title: string;
  skills: Skill[];
};

export const store = createBitStore<ProfileForm>({
  initialValues: {
    title: "Frontend Engineer",
    skills: [
      { name: "React", years: 4 },
      { name: "TypeScript", years: 3 },
      { name: "Testing", years: 2 },
    ],
  },
  fields: {
    skills: { scope: "skills" },
  },
});
```

## React UI

```tsx
import { useBitArray } from "@lehnihon/bit-form/react";

export function SkillsList() {
  const skills = useBitArray<{ name: string; years: number }>("skills");

  return (
    <div>
      <button
        type="button"
        onClick={() => skills.append({ name: "", years: 0 })}
      >
        Add Skill
      </button>

      {skills.fields.map((row) => (
        <div key={row.key}>
          <input
            value={row.value?.name ?? ""}
            onChange={(e) =>
              skills.update(row.index, {
                ...(row.value ?? { name: "", years: 0 }),
                name: e.target.value,
              })
            }
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

          <button
            type="button"
            onClick={() =>
              row.index > 0 && skills.move(row.index, row.index - 1)
            }
          >
            Up
          </button>

          <button type="button" onClick={() => skills.remove(row.index)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Expected Behavior

- Removing index `0` shifts values and error paths consistently.
- Reorder operations preserve semantic item-to-error mapping.
- Stable `row.key` prevents UI mismatch during index changes.

## Common Mistakes

| Wrong                        | Correct                                |
| ---------------------------- | -------------------------------------- |
| Use array index as React key | Use `row.key` from `useBitArray`       |
| Mutate array manually        | Use array helper methods               |
| Remap errors in UI manually  | Let Bit-Form handle error reallocation |

## Related

- [Field Arrays](../features/field-arrays.md)
- [Testing Guide](../guides/testing.md)
