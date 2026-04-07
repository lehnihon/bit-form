# Accessibility Guide

Bit-Form does not replace accessibility requirements from your UI stack. Use this guide to build accessible forms consistently.

## Baseline Requirements

1. Every input must have an associated label.
2. Validation state must be programmatically exposed.
3. Error text must be linked to the field.
4. Keyboard navigation must remain intact.

## Field Accessibility Pattern

For each field:

- Set a stable `id` on the input.
- Link label with `htmlFor` (or framework equivalent).
- Set `aria-invalid` when field is invalid.
- Use `aria-describedby` to connect error/help text IDs.

## Error Announcements

- Use `aria-live="polite"` for non-blocking validation updates.
- Use `aria-live="assertive"` only for critical blocking errors.

## Conditional Fields

When using dynamic visibility:

- Prefer store-level conditional logic for consistency.
- Ensure hidden fields are not focusable.
- Ensure hidden field errors are removed from active announcements.

## Submit UX

- Keep submit button label descriptive.
- Announce submitting state for assistive tech where needed.
- Move focus to first invalid field after failed submit.

## Framework Notes

- React / Next.js / React Native: keep field props and ARIA props colocated.
- Vue: map composable field meta to ARIA attributes in template.
- Angular: bind ARIA attributes to signal/computed metadata.

## Accessibility Checklist

1. Labels are present and explicit.
2. Error messaging is connected and announced.
3. Focus order is logical.
4. Keyboard-only submit and correction flow is valid.
5. Conditional rendering does not leave unreachable focus targets.

## Related

- [React + shadcn/ui](../frameworks/react-shadcn.md)
- [Validation](../features/validation.md)
- [Troubleshooting](./troubleshooting.md)
