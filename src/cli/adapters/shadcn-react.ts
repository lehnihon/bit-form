import type { Adapter, AddContext } from "./types";
import {
  shadcnReactTemplates,
  shadcnReactComponentNames,
} from "../templates/shadcn/react";

export const shadcnReactAdapter: Adapter = {
  name: "shadcn",
  framework: "react",
  components: shadcnReactComponentNames,

  renderComponent(component: string, ctx: AddContext) {
    const normalized = component.toLowerCase().replace(/\s+/g, "-");
    const templateFn = shadcnReactTemplates[normalized];
    if (!templateFn) {
      throw new Error(
        `Unknown shadcn component: ${component}. Available: ${shadcnReactComponentNames.join(", ")}`,
      );
    }
    const contents = templateFn(ctx.uiPath);
    const filename =
      normalized === "radio-group"
        ? "bit-form-radio-group.tsx"
        : `bit-form-${normalized}.tsx`;
    return { filename, contents };
  },
};
