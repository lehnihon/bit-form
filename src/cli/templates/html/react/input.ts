export function inputTemplate(): string {
  return `"use client";

import { useBitField } from "@lehnihon/bit-form/react";

export interface BitFormInputProps {
  path: string;
  label?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  className?: string;
  id?: string;
}

export function BitFormInput({
  path,
  label,
  description,
  placeholder,
  type = "text",
  className,
  id,
}: BitFormInputProps) {
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
      <input
        id={inputId}
        type={type}
        value={field.props.value}
        onChange={field.props.onChange}
        onBlur={field.props.onBlur}
        placeholder={placeholder}
        className={className}
        aria-invalid={meta.invalid || undefined}
        aria-required={meta.isRequired || undefined}
      />
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {meta.error && <p className="text-sm text-red-600">{meta.error}</p>}
    </div>
  );
}
`;
}
