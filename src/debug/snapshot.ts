import type {RenderFrame,StreamFrame,SurfaceContact} from '../core/RenderFrame.ts';

const snapshotContact=(contact:SurfaceContact)=>({local:{...contact.local},world:{...contact.world},tangent:{...contact.tangent},empty:contact.empty});
const snapshotStream=(s:StreamFrame)=>({...s,start:{...s.start},control:{...s.control},end:{...s.end}});

export function snapshotFrame(frame:RenderFrame){
  return{
    now:frame.now,
    board:frame.board.map(glass=>[...glass]),
    glasses:frame.glasses.map(glass=>({
      index:glass.index,localScale:glass.localScale??1,pose:{...glass.pose},surfaceAngle:glass.surfaceAngle,
      relativeLiquidRotation:glass.relativeLiquidRotation,wave:glass.wave,phase:glass.phase,
      dynamicLiquid:glass.dynamicLiquid,
      layers:glass.layers.map(layer=>({color:layer.color,amount:layer.amount,bottom:layer.bottom,top:layer.top,isTop:layer.isTop,wavy:layer.wavy,surface:layer.surface?Array.from(layer.surface):null})),
      contact:snapshotContact(glass.contact),
      response:glass.response?{contact:snapshotContact(glass.response.contact),intensity:glass.response.intensity,spread:glass.response.spread}:null,
      selected:glass.selected,hintRole:glass.hintRole,hintStrength:glass.hintStrength,
      cap:{...glass.cap},completion:{...glass.completion,particles:glass.completion.particles.map(p=>({...p}))},
      invalid:glass.invalid,invalidStrength:glass.invalidStrength,moving:glass.moving
    })),
    streams:frame.streams.map(snapshotStream),
    flights:frame.flights.map(f=>({...f,stream:f.stream?snapshotStream(f.stream):null})),
    stream:frame.stream?snapshotStream(frame.stream):null,
    metrics:{...frame.metrics},events:[...frame.events]
  };
}
