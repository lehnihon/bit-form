# 🅱️ BitForm
**Ultra-lightweight (2kb), Atomic, and Framework-Agnostic Form Engine.**

- ⚛️ **React**: `useSyncExternalStore`
- 🟢 **Vue**: `Refs` & `Computed`
- 🅰️ **Angular**: `Signals`
- 🛡️ **Validation**: Zod, Yup, Joi

### Quick Start (React)
```typescript
const store = new BitFormStore({ name: '' });

function MyInput() {
  const { value, setValue, error } = useBitField(store, 'name');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}