import { inputTemplate } from "./input";
import { textareaTemplate } from "./textarea";
import { selectTemplate } from "./select";
import { checkboxTemplate } from "./checkbox";
import { switchTemplate } from "./switch";
import { radioGroupTemplate } from "./radio-group";

export const shadcnReactTemplates: Record<
  string,
  (uiPath: string) => string
> = {
  input: inputTemplate,
  textarea: textareaTemplate,
  select: selectTemplate,
  checkbox: checkboxTemplate,
  switch: switchTemplate,
  "radio-group": radioGroupTemplate,
};

export const shadcnReactComponentNames = Object.keys(shadcnReactTemplates);
