const glyphs:Record<string,string>={
 hint:'<path d="M12 3.5c3.6 3.2 5.2 5.6 5.2 8.2a5.2 5.2 0 0 1-10.4 0c0-1.6.8-3.2 2.4-4.6.3 1.3.9 2 1.7 2.4C10.6 7.6 11 5.6 12 3.5Z"/><path d="M12 10c2 2 2.6 3.1 2.6 4.3a2.6 2.6 0 0 1-5.2 0c0-1.1 1-2.2 2.6-4.3Z" fill="currentColor" stroke="none" opacity=".6"/><path d="M9.4 20.5h5.2"/>',
 undo:'<path d="M9 7h5.5a4.5 4.5 0 0 1 0 9H8M9.2 3.6 5.4 7l3.8 3.4"/>',
 restart:'<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5M19.6 4.2v3.8h-3.8"/><path d="M13 9a3 3 0 1 0 2 5 3 3 0 0 1-2-5Z" fill="currentColor" stroke="none"/>',
 skip:'<path d="M5.5 6l6 6-6 6M12.5 6l6 6-6 6M20 6v12"/>',
 settings:'<path d="M10 3.2q2-1 4 0l.6 2 1.5.6 1.8-1q2 1 2.7 2.8l-1 1.7.6 1.5 2 .6q.8 2 0 4l-2 .6-.6 1.5 1 1.8q-1 2-2.8 2.7l-1.7-1-1.5.6-.6 2q-2 .8-4 0l-.6-2-1.5-.6-1.8 1q-2-1-2.7-2.8l1-1.7-.6-1.5-2-.6q-.8-2 0-4l2-.6.6-1.5-1-1.8q1-2 2.8-2.7l1.7 1 1.5-.6Z" transform="translate(1.3 1.3) scale(.89)"/><path d="M13 9a3 3 0 1 0 2.2 5 3 3 0 0 1-2.2-5Z" fill="currentColor" stroke="none"/>',
 sound:'<path d="M4 9.5h3.2L11.5 6v12L7.2 14.5H4z"/><path class="moving-parts" d="M14.5 9.2a4 4 0 0 1 0 5.6M16.8 7a7 7 0 0 1 0 10"/>',
 haptics:'<rect x="8.5" y="4" width="7" height="16" rx="1.8"/><path class="moving-parts" d="M5.7 8q-2 4 0 8M2.8 6q-3 6 0 12M18.3 8q2 4 0 8M21.2 6q3 6 0 12"/>',
 motion:'<circle cx="15" cy="12" r="4"/><g class="moving-parts"><path d="M3 9h6" opacity=".5"/><path d="M2 12h7"/><path d="M3 15h6" opacity=".7"/></g>',
 close:'<path d="m7 7 10 10M17 7 7 17"/>',
};
export function gameplayGlyph(name:string){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name]??''}</svg>`;}
