declare interface JQuery {
  localize(): () => any;
}

declare module 'jquery-i18next' {
  export function init(...args: any[]): any;
}

interface JQueryStatic {
  t(key: string): string;
}