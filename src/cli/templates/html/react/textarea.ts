export function textareaTemplate(): string {
  return `"use client";

import { useBitField } from "@lehnihon/bit-form/react";

export interface BitFormTextareaProps {
  path: string;
  label?: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
}

export function BitFormTextarea({
  path,
  label,
  description,
  placeholder,
  rows = 3,
  className,
  id,
}: BitFormTextareaProps) {
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
      <textarea
        id={inputId}
        value={field.props.value}
        onChange={field.props.onChange}
        onBlur={field.props.onBlur}
        placeholder={placeholder}
        rows={rows}
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
