# Conditional Logic & Dependencies

Forms often require fields to appear, disappear, or become mandatory based on the values of other fields. Bit-Form's `BitDependencyManager` handles this natively.

## Registering Dependencies

You can configure fields using the `fields` property in `createBitStore`, or dynamically using `store.registerField()`.

```tsx
const store = createBitStore({
  initialValues: {
    documentType: "CPF",
    documentNumber: "",
  },
  fields: {
    documentNumber: {
      conditional: {
        dependsOn: ["documentType"],
        showIf: (values) => values.documentType === "CNPJ",
        requiredIf: (values) => values.documentType === "CNPJ",
        requiredMessage: "Document number is required for CNPJ",
      },
    },
  },
});
```

## Behavior

1. **`showIf`**: If this returns `false`, the field is considered "hidden".
   - `useBitField` will return `isHidden: true`.
   - **Data Cleanup**: When the form is submitted, any hidden fields will be stripped from the final payload.
   - **Error Cleanup**: If a field has validation errors and then becomes hidden, its errors are automatically cleared.
2. **`requiredIf`**: If this returns `true` and the field is empty, Bit-Form will block submission and show a required error. Use `requiredMessage` for a custom message; otherwise it defaults to `"required field"`.
3. **`dependsOn`**: This array is required. It tells the engine exactly which fields should trigger a re-evaluation of the rules when changed.
