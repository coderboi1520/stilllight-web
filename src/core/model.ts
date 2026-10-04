import {StilllightModel as BaseStilllightModel} from './modelBase.ts';
import {EPSILON} from './constants.ts';
import {liquidLevel,sampleAreaPreservingSurface} from './liquidMath.ts';
import type {RenderFrame} from './RenderFrame.ts';

export class StilllightModel extends BaseStilllightModel{
  private undoSurfaceOwnership=false;

  override reset(){
    this.undoSurfaceOwnership=false;
    super.reset();
  }

  override undo(now:number){
    const accepted=super.undo(now);
    if(accepted)this.undoSurfaceOwnership=true;
    return accepted;
  }

  override sample(now:number):RenderFrame{
    const frame=super.sample(now);
    if(!this.undoSurfaceOwnership)return frame;
    for(const glass of frame.glasses){
      let total=0,boundary=liquidLevel(0,0);
      for(const layer of glass.layers){
        layer.bottom=boundary;
        total+=layer.amount;
        layer.top=liquidLevel(total,0);
        boundary=layer.top;
        layer.isTop=false;
        layer.wavy=false;
      }
      const top=glass.layers.at(-1);
      if(top){
        top.isTop=true;top.wavy=true;
        sampleAreaPreservingSurface(total,glass.surfaceAngle,glass.wave,glass.phase,top.surface!);
        // Renderers hide tiny bodies; keep the surface on the visible same-color mass too.
        const below=glass.layers[glass.layers.length-2];
        if(top.amount<=EPSILON&&below&&below.color===top.color){
          below.wavy=true;below.surface!.set(top.surface!);
        }
      }
      glass.relativeLiquidRotation=0;
    }
    return frame;
  }

  override advanceAfterFrame(now:number){
    const wasUndo=this.flights.some(flight=>flight.kind==='undo');
    const changed=super.advanceAfterFrame(now);
    if(this.undoSurfaceOwnership&&!this.flights.length&&!this.settleMotion)this.undoSurfaceOwnership=false;
    else if(wasUndo)this.undoSurfaceOwnership=true;
    return changed;
  }
}
