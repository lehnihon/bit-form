export function selectTemplate(): string {
  return `"use client";

import { useBitField } from "@lehnihon/bit-form/react";

export interface BitFormSelectOption {
  value: string;
  label: string;
}

export interface BitFormSelectProps {
  path: string;
  label?: string;
  description?: string;
  placeholder?: string;
  options: BitFormSelectOption[];
  className?: string;
  id?: string;
}

export function BitFormSelect({
  path,
  label,
  description,
  placeholder = "Select...",
  options,
  className,
  id,
}: BitFormSelectProps) {
  const field = useBitField(path);
  const { meta } = field;

  if (meta.isHidden) return null;

  const inputId = id ?? path;

  return (
    <div className="space-y-2" data-invalid={meta.invalid || undefined}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium leading-none">
          {label}
          {meta.isRequired && <span className="ml-1 text-red-600">*</span>}
        </label>
      )}
      <select
        id={inputId}
        value={field.props.value}
        onChange={field.props.onChange}
        onBlur={field.props.onBlur}
        className={className}
        aria-invalid={meta.invalid || undefined}
        aria-required={meta.isRequired || undefined}
      >
        <option value="" disabled={meta.isRequired}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {meta.error && <p className="text-sm text-red-600">{meta.error}</p>}
    </div>
  );
}
`;
}
