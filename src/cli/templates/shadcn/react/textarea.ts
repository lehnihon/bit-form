export function textareaTemplate(uiPath: string): string {
  return `"use client";

import { Textarea } from "${uiPath}/textarea";
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
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {meta.isRequired && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <Textarea
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
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {meta.error && (
        <p className="text-sm text-destructive">{meta.error}</p>
      )}
    </div>
  );
}
`;
}
