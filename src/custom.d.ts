declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module '*.py?raw' {
  const source: string;
  export default source;
}

declare module '*.cs?raw' {
  const source: string;
  export default source;
}
