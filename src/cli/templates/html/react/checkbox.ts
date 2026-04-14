export function checkboxTemplate(): string {
  return `"use client";

import { useBitField } from "@lehnihon/bit-form/react";

export interface BitFormCheckboxProps {
  path: string;
  label?: string;
  description?: string;
  className?: string;
  id?: string;
}

export function BitFormCheckbox({
  path,
  label,
  description,
  className,
  id,
}: BitFormCheckboxProps) {
  const field = useBitField(path);
  const { meta } = field;

  if (meta.isHidden) return null;

  const inputId = id ?? path;

  return (
    <div className="space-y-2" data-invalid={meta.invalid || undefined}>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(field.value)}
          onChange={(event) => field.setValue(event.target.checked)}
          onBlur={field.setBlur}
          className={className}
          aria-invalid={meta.invalid || undefined}
          aria-required={meta.isRequired || undefined}
        />
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium leading-none">
            {label}
            {meta.isRequired && <span className="ml-1 text-red-600">*</span>}
          </label>
        )}
      </div>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {meta.error && <p className="text-sm text-red-600">{meta.error}</p>}
    </div>
  );
}
`;
}
