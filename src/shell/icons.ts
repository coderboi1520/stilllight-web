const paths:Record<string,string>={
 home:'<path d="m3 11 9-8 9 8M6 9v11h12V9M10 20v-7h4v7"/>',
 settings:'<path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
 moon:'<path d="M17 3a9 9 0 1 0 4 14A9 9 0 0 1 17 3Z"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 levels:'<circle cx="5" cy="7" r="3"/><circle cx="19" cy="7" r="3"/><circle cx="12" cy="19" r="3"/><path d="m7 9 4 7m6-7-4 7M8 7h8"/>',
 book:'<path d="M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3ZM12 6v15M6 8h3m6 0h3M6 12h3m6 0h3"/>',
 sound:'<path d="M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 haptics:'<rect x="8" y="3" width="8" height="18" rx="2"/><path d="m4 6-2 3 2 3-2 3 2 3m16-12 2 3-2 3 2 3-2 3"/>',
 motion:'<path d="M5 8h11a5 5 0 0 1 0 10h-4M3 12h8m-6 4h3M14 3l5 5-5 5"/>',
 back:'<path d="m10 5-7 7 7 7M3 12h18"/>',
 check:'<path d="m5 12 5 5L20 7"/>',
 lock:'<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
};
export function icon(name:string){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??''}</svg>`;}
