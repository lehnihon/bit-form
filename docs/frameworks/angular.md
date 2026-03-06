# Angular Integration

Bit-Form provides a modern, Signal-based integration for Angular. It leverages Angular's native Dependency Injection and Signals (`@angular/core`) for high-performance reactivity.

## 1. Provide the Store

Create your `BitStore` instance and provide it to your component or application using `provideBitStore`.

```typescript
import { Component } from "@angular/core";
import { BitStore } from "@lehnihon/bit-form";
import { provideBitStore } from "@lehnihon/bit-form/angular";
import { FormContentComponent } from "./form-content.component";

const myStore = new BitStore({
  initialValues: { name: "", document: "" },
});

@Component({
  selector: "app-root",
  standalone: true,
  imports: [FormContentComponent],
  providers: [provideBitStore(myStore)],
  template: `<app-form-content></app-form-content>`,
})
export class AppComponent {}
```

## 2. Connect Fields and Form Logic

Use `injectBitForm` and `injectBitField` inside your child components.

### Form Structure

`injectBitForm` returns an object with:

- `meta`: readonly state signals (execute with `()` in templates)
  - `isValid()`, `isDirty()`, `isSubmitting()`, `canUndo()`, `canRedo()`
  - `submitError()`, `lastResponse()`
- Main actions: `submit`, `onSubmit`, `reset`, `setField`, etc. (remain flat)
- `mutations`: secondary actions for array operations
  - `pushItem()`, `removeItem()`, etc.
- `history`: time-travel operations
  - `undo()`, `redo()`

Custom mask registration is done directly on the store (`store.registerMask(...)`), not on `injectBitForm`.

### Field Structure

`injectBitField` returns:

- Value + handlers at root level: `displayValue()`, `setValue()`, `setBlur()`, `update()`
- `meta`: state signals (`invalid()`, `error()`, `touched()`, `isDirty()`, `isValidating()`, `isHidden()`, `isRequired()`)

Since they are Signals, execute them like functions `()` in templates.

### Example

```typescript
import { Component } from "@angular/core";
import { injectBitForm, injectBitField } from "@lehnihon/bit-form/angular";

@Component({
  selector: "app-form-content",
  standalone: true,
  template: `
    <form (submit)="onSubmit($event)">
      <div>
        <label>Name</label>
        <input
          [value]="nameField.displayValue()"
          (input)="nameField.update($event)"
          (blur)="nameField.setBlur()"
        />
        @if (nameField.meta.invalid()) {
          <span style="color: red">{{ nameField.meta.error() }}</span>
        }
      </div>

      <button
        type="submit"
        [disabled]="!form.meta.isValid() || form.meta.isSubmitting()"
      >
        Save
      </button>
    </form>
  `,
})
export class FormContentComponent {
  form = injectBitForm();
  nameField = injectBitField("name");

  onSubmit = this.form.submit((values) => {
    console.log("Angular Data:", values);
  });
}
```

## 3. Arrays with Signals

For dynamic array fields, use `injectBitArray`. The `fields()` signal automatically manages unique keys for track-by loops (`@for`).

```typescript
import { Component } from "@angular/core";
import { injectBitArray } from "@lehnihon/bit-form/angular";

@Component({
  selector: "app-tags",
  standalone: true,
  template: `
    <div>
      @for (item of tags.fields(); track item.key) {
        <div>
          <span>{{ item.value }}</span>
          <button type="button" (click)="tags.remove(item.index)">
            Remove
          </button>
        </div>
      }
      <button type="button" (click)="tags.append('New Tag')">Add</button>
    </div>
  `,
})
export class TagsComponent {
  tags = injectBitArray<string>("tags");
}
```

## 4. Scoped Validation with `injectBitScope`

For multi-step or wizard forms, define `scopes` in your store and use `injectBitScope` to validate and track status per step.

```typescript
import { injectBitScope } from "@lehnihon/bit-form/angular";

@Component({...})
export class WizardStep1Component {
  // Store config: scopes: { step1: ["name", "email"], step2: ["address"] }
  step1 = injectBitScope("step1");

  async handleNext() {
    const { valid } = await this.step1.validate();
    if (valid) this.goToStep(2);
  }
}
```

```html
<button (click)="handleNext()" [disabled]="!step1.isValid()">Próximo</button>
```

See [Scopes](../features/scopes.md) for full documentation.
