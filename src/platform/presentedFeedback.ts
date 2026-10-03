import type {RenderFrame} from '../core/RenderFrame.ts';
// Sampling does not emit feedback. The live presenter calls this once per frame,
// then owns transaction deduplication; missed contact frames stay silent.
export function presentedPourContact(frame:RenderFrame,reducedMotion:boolean):boolean{
  return reducedMotion?frame.metrics.transfer>0&&frame.metrics.transfer<1:
    !!frame.stream?.visible&&frame.stream.reveal===1&&frame.metrics.transfer>0;
}
