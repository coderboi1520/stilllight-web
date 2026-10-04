import type {RenderFrame} from '../core/RenderFrame.ts';
// Sampling does not emit feedback. The live presenter calls this once per frame,
// then owns transaction deduplication; missed contact frames stay silent.
export function presentedPourContact(frame:RenderFrame,reducedMotion:boolean,id?:number):boolean{
  const flight=id===undefined?frame.flights[0]:frame.flights.find(f=>f.id===id);
  if(!flight||flight.kind!=='pour')return false;
  return reducedMotion?flight.transfer>0&&flight.transfer<1:
    !!flight.stream?.visible&&flight.stream.reveal===1&&flight.transfer>0;
}
