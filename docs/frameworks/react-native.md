# React Native Integration

Bit-Form is fully compatible with React Native. The core API is identical to React, with a few crucial adaptations to perfectly map to mobile components like `TextInput`.

## Installation Note

Make sure to import your hooks from `@lehnihon/bit-form/react-native` instead of `@lehnihon/bit-form/react`.

```tsx
// ❌ Wrong for Mobile
import { useBitField } from "@lehnihon/bit-form/react";

// ✅ Correct for Mobile
import { useBitField, BitFormProvider } from "@lehnihon/bit-form/react-native";
```

## `useBitField` and `TextInput`

In React Native, inputs use `onChangeText` instead of `onChange`, and they strictly require the value to be a `string`. The `useBitField` hook from the `react-native` entry point automatically handles this mapping for you in its `props` object.

The hook returns:

- `field`: value + handlers (`setValue`, `setBlur`, `onChangeText`, `onBlur`)
- `meta`: UI/validation state (`invalid`, `error`, `touched`, `isDirty`, etc.)
- `props`: `TextInput` helper (`value`, `onChangeText`, `onBlur`)

```tsx
import React from "react";
import { View, TextInput, Text, Button } from "react-native";
import { useBitField, useBitForm } from "@lehnihon/bit-form/react-native";

export function ProfileForm() {
  // Connect field to store
  const nameField = useBitField("name");
  const { submit } = useBitForm();

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

Everything else, including `useBitArray`, `useBitScope`, `useBitStore`, and `BitFormProvider`, works exactly the same as in the standard React integration.
