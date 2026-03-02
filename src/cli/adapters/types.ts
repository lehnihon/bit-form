export interface AddContext {
  cwd: string;
  path: string;
  uiPath: string;
  overwrite: boolean;
  yes: boolean;
}

export interface Adapter {
  name: string;
  framework: "react" | "vue" | "angular";
  components: string[];
  renderComponent(
    component: string,
    ctx: AddContext,
  ): { filename: string; contents: string };
}
