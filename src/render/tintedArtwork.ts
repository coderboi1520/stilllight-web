const cache=new WeakMap<CanvasImageSource,Map<string,HTMLCanvasElement>>();
export function tintedArtwork(source:HTMLImageElement|HTMLCanvasElement,color:string,monochrome=false){
 if(color==='#ffffff'&&!monochrome)return source;let colors=cache.get(source);if(!colors){colors=new Map();cache.set(source,colors);}const key=color+monochrome,old=colors.get(key);if(old)return old;
 const c=document.createElement('canvas');c.width=source instanceof HTMLImageElement?source.naturalWidth:source.width;c.height=source instanceof HTMLImageElement?source.naturalHeight:source.height;const ctx=c.getContext('2d')!;if(monochrome)ctx.filter='grayscale(1)';ctx.drawImage(source,0,0);ctx.filter='none';ctx.globalCompositeOperation='multiply';ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);ctx.globalCompositeOperation='destination-in';ctx.drawImage(source,0,0);colors.set(key,c);return c;
}
