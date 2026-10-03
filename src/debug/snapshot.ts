import type {RenderFrame,SurfaceContact} from '../core/RenderFrame.ts';

const snapshotContact=(contact:SurfaceContact)=>({local:{...contact.local},world:{...contact.world},tangent:{...contact.tangent},empty:contact.empty});

export function snapshotFrame(frame:RenderFrame){
  return{
    now:frame.now,
    board:frame.board.map(glass=>[...glass]),
    glasses:frame.glasses.map(glass=>({
      index:glass.index,pose:{...glass.pose},surfaceAngle:glass.surfaceAngle,
      relativeLiquidRotation:glass.relativeLiquidRotation,wave:glass.wave,phase:glass.phase,
      dynamicLiquid:glass.dynamicLiquid,
      layers:glass.layers.map(layer=>({color:layer.color,amount:layer.amount,bottom:layer.bottom,top:layer.top,isTop:layer.isTop,wavy:layer.wavy,surface:layer.surface?Array.from(layer.surface):null})),
      contact:snapshotContact(glass.contact),
      response:glass.response?{contact:snapshotContact(glass.response.contact),intensity:glass.response.intensity,spread:glass.response.spread}:null,
      selected:glass.selected,hintRole:glass.hintRole,hintStrength:glass.hintStrength,
      cap:{...glass.cap},completion:{...glass.completion,particles:glass.completion.particles.map(p=>({...p}))},
      invalid:glass.invalid,invalidStrength:glass.invalidStrength,moving:glass.moving
    })),
    stream:frame.stream?{
      visible:frame.stream.visible,color:frame.stream.color,alpha:frame.stream.alpha,
      reveal:frame.stream.reveal,widthScale:frame.stream.widthScale,
      start:{...frame.stream.start},control:{...frame.stream.control},end:{...frame.stream.end}
    }:null,
    metrics:{...frame.metrics},events:[...frame.events]
  };
}
