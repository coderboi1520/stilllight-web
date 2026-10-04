import {cosmetic,finishColors,DEFAULT_EQUIPPED} from '../session/catalog.ts';
import {makeGlassArtwork} from '../render/glassMaterial.ts';
import {tintedArtwork} from '../render/tintedArtwork.ts';
let cap:HTMLImageElement|null=null;let glass:ReturnType<typeof makeGlassArtwork>|null=null;
export async function cosmeticPreview(host:HTMLElement,id:string){
 const c=cosmetic(id);host.replaceChildren();host.dataset.cosmetic=id;
 if(c.category==='background'){host.className+=' background-preview';host.dataset.background=id;return;}
 const canvas=document.createElement('canvas');canvas.width=180;canvas.height=210;const ctx=canvas.getContext('2d')!;const colors=finishColors({...DEFAULT_EQUIPPED,[c.category]:id});
 if(c.category==='cap'){if(!cap){cap=new Image();cap.src='/assets/pumpkin-cap.png';}await cap.decode();ctx.drawImage(tintedArtwork(cap,colors.cap,colors.cap!=='#ffffff'),15,35,150,150);}
 else{if(!glass)glass=makeGlassArtwork();ctx.drawImage(glass.shadow,0,0);ctx.drawImage(glass.base,56,36,68,158);ctx.drawImage(tintedArtwork(glass.reflection,colors.glass),56,36,68,158);ctx.drawImage(tintedArtwork(glass.edge,colors.glass),56,36,68,158);ctx.drawImage(tintedArtwork(glass.rim,colors.glass),0,0);}
 host.append(canvas);
}
