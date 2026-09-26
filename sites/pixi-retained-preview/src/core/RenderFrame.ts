import type {Point,Pose} from './geometry.ts';
export type LiquidLayerFrame={color:number;amount:number;bottom:number;top:number;isTop:boolean;wavy:boolean;surface?:Float64Array};
export type GlassFrame={index:number;pose:Pose;surfaceAngle:number;relativeLiquidRotation:number;wave:number;phase:number;dynamicLiquid:boolean;layers:LiquidLayerFrame[];selected:boolean;hintRole:'source'|'target'|null;invalid:boolean;moving:boolean};
export type StreamFrame={visible:boolean;color:number;alpha:number;start:Point;control:Point;end:Point;impact:number};
export type RenderFrame={now:number;board:readonly (readonly number[])[];glasses:[GlassFrame,GlassFrame];stream:StreamFrame|null;events:readonly string[];metrics:{pourProgress:number;transfer:number;settleProgress:number}};
