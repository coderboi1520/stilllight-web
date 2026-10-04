import type {RenderFrame} from '../core/RenderFrame.ts';
import {CanvasRenderer} from './CanvasRenderer.ts';
import {PixiRenderer} from './pixi/PixiRenderer.ts';
import {selectBackend,type Backend} from './backendPolicy.ts';
import type {Presentation} from './workbench.ts';

export class StageRenderer{
  private renderer:PixiRenderer|CanvasRenderer|null=null;
  backend:Backend='canvas';
  constructor(private vesselCount=2){}
  async init(host:HTMLElement,onRestore:()=>void){
    const probe=document.createElement('canvas');const hasWebGL=!!(probe.getContext('webgl2')||probe.getContext('webgl'));
    if(selectBackend(hasWebGL)==='webgl'){const pixi=new PixiRenderer(this.vesselCount);try{await pixi.init(host,onRestore);this.renderer=pixi;this.backend='webgl';return;}catch{pixi.destroy();}}
    const canvas=new CanvasRenderer();await canvas.init(host);this.renderer=canvas;this.backend='canvas';
  }
  resize(width:number,height:number,density:number){this.renderer?.resize(width,height,density);}
  render(frame:RenderFrame){this.renderer?.render(frame);}
  setPresentation(mode:Presentation){this.renderer?.setPresentation(mode);}
  setRestoration(count:number,alpha=1){this.renderer?.setRestoration(count,alpha);}
  destroy(){this.renderer?.destroy();}
}
