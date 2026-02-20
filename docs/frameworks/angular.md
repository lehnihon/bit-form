# Angular Integration

Bit-Form provides a modern, Signal-based integration for Angular. It leverages Angular's native Dependency Injection and Signals (`@angular/core`) for high-performance reactivity.

## 1. Provide the Store

Create your `BitStore` instance and provide it to your component or application using `provideBitStore`.

```typescript
import { Component } from "@angular/core";
import { BitStore } from "bit-form";
import { provideBitStore } from "bit-form/angular";
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

Use `injectBitForm` and `injectBitField` inside your child components. Since they return Signals, you execute them like functions `()` in your templates.

```typescript
import { Component } from "@angular/core";
import { injectBitForm, injectBitField } from "bit-form/angular";

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
        @if (nameField.invalid()) {
          <span style="color: red">{{ nameField.error() }}</span>
        }
      </div>

      <button type="submit" [disabled]="!form.isValid() || form.isSubmitting()">
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

For dynamic array fields, use `injectBitFieldArray`. The `fields()` signal automatically manages unique keys for track-by loops (`@for`).

```typescript
import { Component } from "@angular/core";
import { injectBitFieldArray } from "bit-form/angular";

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
  tags = injectBitFieldArray<string>("tags");
}
```
