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

  if (field.isHidden) return null;

  const inputId = id ?? path;

  return (
    <div className="space-y-2" data-invalid={field.invalid || undefined}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <Select
        value={field.value ?? ""}
        onValueChange={(val) => field.setValue(val)}
      >
        <SelectTrigger
          id={inputId}
          className={className}
          aria-invalid={field.invalid || undefined}
          aria-required={field.isRequired || undefined}
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
      {field.error && (
        <p className="text-sm text-destructive">{field.error}</p>
      )}
    </div>
  );
}
`;
}
