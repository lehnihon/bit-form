import {
  htmlReactComponentNames,
  htmlReactTemplates,
} from "../templates/html/react";
import type { Adapter, AddContext } from "./types";

export const htmlReactAdapter: Adapter = {
  name: "html",
  framework: "react",
  components: htmlReactComponentNames,

  renderComponent(component: string, _ctx: AddContext) {
    const normalized = component.toLowerCase().replace(/\s+/g, "-");
    const templateFn = htmlReactTemplates[normalized];
    if (!templateFn) {
      throw new Error(
        `Unknown html component: ${component}. Available: ${htmlReactComponentNames.join(", ")}`,
      );
    }

    const filename = `bit-form-${normalized}.tsx`;
    return { filename, contents: templateFn() };
  },
};
