export type Backend='webgl'|'canvas';
export const selectBackend=(hasWebGL:boolean):Backend=>hasWebGL?'webgl':'canvas';
