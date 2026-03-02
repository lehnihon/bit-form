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

  if (field.isHidden) return null;

  const inputId = id ?? path;

  return (
    <div className="space-y-2" data-invalid={field.invalid || undefined}>
      {label && (
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <RadioGroup
        value={field.value ?? ""}
        onValueChange={(val) => field.setValue(val)}
        className={className}
        aria-invalid={field.invalid || undefined}
        aria-required={field.isRequired || undefined}
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
      {field.error && (
        <p className="text-sm text-destructive">{field.error}</p>
      )}
    </div>
  );
}
`;
}
