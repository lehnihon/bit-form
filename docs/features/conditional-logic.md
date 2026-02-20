# Conditional Logic & Dependencies

Forms often require fields to appear, disappear, or become mandatory based on the values of other fields. Bit-Form's `BitDependencyManager` handles this natively.

## Registering Dependencies

You can configure fields using the `fields` property in the `BitStore` constructor, or dynamically using `store.registerConfig()`.

```tsx
const store = new BitStore({
  initialValues: {
    documentType: "CPF",
    documentNumber: "",
  },
  fields: {
    documentNumber: {
      dependsOn: ["documentType"], // Tell Bit-Form to watch this field
      showIf: (values) => values.documentType === "CNPJ",
      requiredIf: (values) => values.documentType === "CNPJ",
    },
  },
});
```

## Behavior

1. **`showIf`**: If this returns `false`, the field is considered "hidden".
   - `useBitField` will return `isHidden: true`.
   - **Data Cleanup**: When the form is submitted, any hidden fields will be stripped from the final payload.
   - **Error Cleanup**: If a field has validation errors and then becomes hidden, its errors are automatically cleared.
2. **`requiredIf`**: If this returns `true` and the field is empty, Bit-Form will block the submission and throw an internal "Required" error.
3. **`dependsOn`**: This array is required. It tells the engine exactly which fields should trigger a re-evaluation of the rules when changed.
