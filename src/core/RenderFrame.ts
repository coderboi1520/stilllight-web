import type {Point,Pose} from './geometry.ts';
export type LiquidLayerFrame={color:number;amount:number;bottom:number;top:number;isTop:boolean;wavy:boolean;surface?:Float64Array};
export type SurfaceContact={local:Point;world:Point;tangent:Point;empty:boolean};
export type ReceiverResponseFrame={contact:SurfaceContact;intensity:number;spread:number};
export type GlassFrame={index:number;pose:Pose;surfaceAngle:number;relativeLiquidRotation:number;wave:number;phase:number;dynamicLiquid:boolean;layers:LiquidLayerFrame[];contact:SurfaceContact;response:ReceiverResponseFrame|null;selected:boolean;hintRole:'source'|'target'|null;hintStrength:number;invalid:boolean;invalidStrength:number;moving:boolean};
export type StreamFrame={visible:boolean;color:number;alpha:number;reveal:number;widthScale:number;start:Point;control:Point;end:Point};
export type RenderFrame={now:number;board:readonly (readonly number[])[];glasses:[GlassFrame,GlassFrame];stream:StreamFrame|null;events:readonly string[];metrics:{pourProgress:number;transfer:number;settleProgress:number}};
