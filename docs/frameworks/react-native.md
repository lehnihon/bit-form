# React Native Integration

Bit-Form is fully compatible with React Native. The core API is identical to React, with a few crucial adaptations to perfectly map to mobile components like `TextInput`.

## Installation Note

Make sure to import your hooks from `bit-form/react-native` instead of `bit-form/react`.

```tsx
// ❌ Wrong for Mobile
import { useBitField } from "bit-form/react";

// ✅ Correct for Mobile
import { useBitField, BitFormProvider } from "bit-form/react-native";
```

## `useBitField` and `TextInput`

In React Native, inputs use `onChangeText` instead of `onChange`, and they strictly require the value to be a `string`. The `useBitField` hook from the `react-native` entry point automatically handles this mapping for you in its `props` object.

```tsx
import React from "react";
import { View, TextInput, Text, Button } from "react-native";
import { useBitField, useBitForm } from "bit-form/react-native";

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
          borderColor: nameField.invalid ? "red" : "gray",
        }}
        placeholder="Enter your name"
      />
      {nameField.invalid && (
        <Text style={{ color: "red" }}>{nameField.error}</Text>
      )}

      <Button title="Save Profile" onPress={handleSave} />
    </View>
  );
}
```

Everything else, including `useBitFieldArray`, `useBitStore`, and `BitFormProvider`, works exactly the same as in the standard React integration.
