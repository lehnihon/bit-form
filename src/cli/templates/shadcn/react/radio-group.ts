export function radioGroupTemplate(uiPath: string): string {
  return `"use client";

import { RadioGroup, RadioGroupItem } from "${uiPath}/radio-group";
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
  const { field: valueField, meta } = field;

  if (meta.isHidden) return null;

  const inputId = id ?? path;

  return (
    <div className="space-y-2" data-invalid={meta.invalid || undefined}>
      {label && (
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {meta.isRequired && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <RadioGroup
        value={valueField.value ?? ""}
        onValueChange={(val) => valueField.setValue(val)}
        className={className}
        aria-invalid={meta.invalid || undefined}
        aria-required={meta.isRequired || undefined}
      >
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={\`\${inputId}-\${opt.value}\`} />
            <label
              htmlFor={\`\${inputId}-\${opt.value}\`}
              className="text-sm font-normal cursor-pointer"
            >
              {opt.label}
            </label>
          </div>
        ))}
      </RadioGroup>
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
