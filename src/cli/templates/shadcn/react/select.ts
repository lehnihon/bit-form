export function selectTemplate(uiPath: string): string {
  return `"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "${uiPath}/select";
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
  const { field: valueField, meta } = field;

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
      <Select
        value={valueField.value ?? ""}
        onValueChange={(val) => valueField.setValue(val)}
      >
        <SelectTrigger
          id={inputId}
          className={className}
          aria-invalid={meta.invalid || undefined}
          aria-required={meta.isRequired || undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
