import type {AudioEvent} from './audio.ts';
import type {HapticKind} from './haptics.ts';
export const FEEDBACK_CAPABILITIES=Object.freeze({audio:true,haptics:true});
// Owner-authorized feedback; engines enforce preferences, activation and lifecycle.
export class FeedbackCapability{
 private audio:{unlock:()=>unknown;play:(e:AudioEvent,t:number)=>unknown};
 private haptics:{trigger:(e:HapticKind,...args:any[])=>unknown};
 constructor(audio:FeedbackCapability['audio'],haptics:FeedbackCapability['haptics']){this.audio=audio;this.haptics=haptics;}
 unlock(){if(FEEDBACK_CAPABILITIES.audio)return this.audio.unlock();}
 sound(e:AudioEvent,t=0){if(FEEDBACK_CAPABILITIES.audio)this.audio.play(e,t);}
 haptic(e:HapticKind,...args:any[]){if(FEEDBACK_CAPABILITIES.haptics)this.haptics.trigger(e,...args);}
}
