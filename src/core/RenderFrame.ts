import type {Point,Pose} from './geometry.ts';
export type LiquidLayerFrame={color:number;amount:number;bottom:number;top:number;isTop:boolean;wavy:boolean;surface?:Float64Array};
export type SurfaceContact={local:Point;world:Point;tangent:Point;empty:boolean};
export type ReceiverResponseFrame={contact:SurfaceContact;intensity:number;spread:number};
export type CapFrame={visible:boolean;alpha:number;y:number;scaleX:number;scaleY:number;rotation:number};
export type CompletionParticleFrame={visible:boolean;x:number;y:number;radius:number;alpha:number;bubble:boolean};
export type CompletionFrame={recoilY:number;color:number;particles:CompletionParticleFrame[]};
export type GlassFrame={index:number;localScale?:number;pose:Pose;surfaceAngle:number;relativeLiquidRotation:number;wave:number;phase:number;dynamicLiquid:boolean;layers:LiquidLayerFrame[];contact:SurfaceContact;response:ReceiverResponseFrame|null;cap:CapFrame;completion:CompletionFrame;selected:boolean;hintRole:'source'|'target'|null;hintStrength:number;invalid:boolean;invalidStrength:number;moving:boolean};
export type StreamFrame={id:number;source:number;target:number;visible:boolean;color:number;alpha:number;reveal:number;widthScale:number;start:Point;control:Point;end:Point};
export type FlightFrame={id:number;source:number;target:number;kind:'pour'|'undo';progress:number;transfer:number;stream:StreamFrame|null};
// stream/metrics retain the first-flight serial fixture interface. Production consumes all flights/streams.
export type RenderFrame={now:number;board:readonly (readonly number[])[];glasses:GlassFrame[];flights:FlightFrame[];streams:StreamFrame[];stream:StreamFrame|null;events:readonly string[];metrics:{pourProgress:number;transfer:number;settleProgress:number}};
