// Coordinates registered to the unchanged 1024×1536 moonlit studio artwork.
// Only existing panes and their sill reflection receive light; mullions stay clear.
const paths=[
 'M292 345 C288 247 292 187 331 171 C353 150 381 164 391 190 C358 202 326 239 325 276 C371 269 405 294 416 337 C374 333 337 323 292 345 Z',
 'M555 437 C580 402 635 379 714 378 L727 478 C680 493 622 477 555 437 Z',
 'M504 128 A78 78 0 0 0 504 270 Z M520 123 A78 78 0 1 1 520 277 Z',
];
const cached=new Map<string,HTMLCanvasElement>();
export function restorationArtwork(count:number,onlyLast=false){
 const key=`${count}:${onlyLast}`;const old=cached.get(key);if(old)return old;
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;const ctx=canvas.getContext('2d')!;
 for(let i=onlyLast?count-1:0;i<count;i++){
  if(i<0||i>2)continue;
  const light=ctx.createRadialGradient([340,661,552][i],[242,430,199][i],12,[340,661,552][i],[242,430,199][i],150);light.addColorStop(0,'rgba(238,222,151,.16)');light.addColorStop(1,'rgba(123,216,236,.02)');ctx.fillStyle=light;ctx.fill(new Path2D(paths[i]));
  const x=[300,575,448][i],w=[155,155,128][i];
  const reflection=ctx.createLinearGradient(0,748,0,799);reflection.addColorStop(0,'rgba(179,224,238,.22)');reflection.addColorStop(1,'rgba(179,224,238,0)');ctx.fillStyle=reflection;ctx.fillRect(x,748,w,51);
 }
 cached.set(key,canvas);return canvas;
}
