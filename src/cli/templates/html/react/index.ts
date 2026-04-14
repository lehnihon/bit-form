import { checkboxTemplate } from "./checkbox";
import { inputTemplate } from "./input";
import { radioGroupTemplate } from "./radio-group";
import { selectTemplate } from "./select";
import { textareaTemplate } from "./textarea";

export const htmlReactTemplates: Record<string, () => string> = {
  input: inputTemplate,
  textarea: textareaTemplate,
  select: selectTemplate,
  checkbox: checkboxTemplate,
  "radio-group": radioGroupTemplate,
};

export const htmlReactComponentNames = Object.keys(htmlReactTemplates);
