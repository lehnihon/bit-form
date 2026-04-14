export function radioGroupTemplate(): string {
  return `"use client";

import { useBitField } from "@lehnihon/bit-form/react";

export interface BitFormRadioOption {
  value: string;
  label: string;
}

export interface BitFormRadioGroupProps {
  path: string;
  label?: string;
  description?: string;
  options: BitFormRadioOption[];
  className?: string;
  id?: string;
}

export function BitFormRadioGroup({
  path,
  label,
  description,
  options,
  className,
  id,
}: BitFormRadioGroupProps) {
  const field = useBitField(path);
  const { meta } = field;

  if (meta.isHidden) return null;

  const inputId = id ?? path;

  return (
    <fieldset className="space-y-2" data-invalid={meta.invalid || undefined}>
      {label && (
        <legend className="text-sm font-medium leading-none">
          {label}
          {meta.isRequired && <span className="ml-1 text-red-600">*</span>}
        </legend>
      )}
      <div className={className} aria-invalid={meta.invalid || undefined}>
        {options.map((option) => {
          const optionId = \`\${inputId}-\${option.value}\`;

          return (
            <label key={option.value} htmlFor={optionId} className="flex items-center gap-2 text-sm">
              <input
                id={optionId}
                type="radio"
                name={inputId}
                value={option.value}
                checked={field.value === option.value}
                onChange={(event) => field.setValue(event.target.value)}
                onBlur={field.setBlur}
                aria-required={meta.isRequired || undefined}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {meta.error && <p className="text-sm text-red-600">{meta.error}</p>}
    </fieldset>
  );
}
`;
}
