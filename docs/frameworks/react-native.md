# React Native Integration

Bit-Form is fully compatible with React Native. The core API is identical to React, with a few crucial adaptations to perfectly map to mobile components like `TextInput`.

## Installation Note

Make sure to import your hooks from `@lehnihon/bit-form/react-native` instead of `@lehnihon/bit-form/react`.

```tsx
// ❌ Wrong for Mobile
import { useBitField } from "@lehnihon/bit-form/react";

// ✅ Correct for Mobile
import { createBitReactNativeForm } from "@lehnihon/bit-form/react-native";
```

## `useBitField` and `TextInput`

In React Native, inputs use `onChangeText` instead of `onChange`, and they strictly require the value to be a `string`. The `useBitField` hook from the `react-native` entry point automatically handles this mapping for you in its `props` object.

The hook returns:

- value + handlers at root level: `value`, `displayValue`, `setValue`, `setBlur`, `onChangeText`, `onBlur`
- `meta`: UI/validation state (`invalid`, `error`, `touched`, `isDirty`, etc.)
- `props`: `TextInput` helper (`value`, `onChangeText`, `onBlur`)

```tsx
import React from "react";
import { View, TextInput, Text, Button } from "react-native";
import { createBitReactNativeForm } from "@lehnihon/bit-form/react-native";

const bit = createBitReactNativeForm({
  initialValues: { name: "" },
});

export function ProfileForm() {
  // Connect field to store
  const nameField = bit.useBitField("name");
  const { submit } = bit.useBitForm();

  const handleSave = submit((values) => {
    console.log("Saved Data:", values);
  });

  return (
    <View>
      <Text>Name:</Text>
      <TextInput
        {...nameField.props} // Automatically injects value, onChangeText, and onBlur
        style={{
          borderWidth: 1,
          borderColor: nameField.meta.invalid ? "red" : "gray",
        }}
        placeholder="Enter your name"
      />
      {nameField.meta.invalid && (
        <Text style={{ color: "red" }}>{nameField.meta.error}</Text>
      )}

      <Button title="Save Profile" onPress={handleSave} />
    </View>
  );
}
```

Everything else, including `useBitArray`, `useBitScope`, and `useBitPersist`, follows the same bindings pattern as the standard React integration.

## Draft Persistence with `useBitPersist`

React Native also exports `useBitPersist` from `@lehnihon/bit-form/react-native`.

```tsx
import { createBitReactNativeForm } from "@lehnihon/bit-form/react-native";

const bit = createBitReactNativeForm({ initialValues: { draft: "" } });

function DraftActions() {
  const persist = bit.useBitPersist();

  return (
    <>
      <Button title="Save Draft" onPress={() => persist.save()} />
      <Button title="Restore Draft" onPress={() => persist.restore()} />
      <Button title="Clear Draft" onPress={() => persist.clear()} />
    </>
  );
}
```

For storage, pass an adapter compatible with AsyncStorage in `persist.storage`.
