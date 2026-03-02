export function checkboxTemplate(uiPath: string): string {
  return `"use client";

import { Checkbox } from "${uiPath}/checkbox";
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

  if (field.isHidden) return null;

  const inputId = id ?? path;
  const checked = Boolean(field.value);

  return (
    <div className="space-y-2" data-invalid={field.invalid || undefined}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={inputId}
          checked={checked}
          onCheckedChange={(checked) => field.setValue(!!checked)}
          onBlur={field.setBlur}
          aria-invalid={field.invalid || undefined}
          aria-required={field.isRequired || undefined}
          className={className}
        />
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {field.isRequired && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
      </div>
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
