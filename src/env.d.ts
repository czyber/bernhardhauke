/// <reference types="astro/client" />

// Monaco's optional editor features register themselves through side-effect imports.
declare module "monaco-editor/editor/contrib/*";
declare module "monaco-editor-icons";
