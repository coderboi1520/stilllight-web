import {sceneGeometry,type SceneProfile} from './sceneGeometry.ts';
import { DEPARTURE_BLEND_MS,DESELECT_RETURN_MS,EPSILON,HINT_ATTENTION_MS,INITIAL,INVALID_MS,POUR_MS,UNDO_MS,SELECT_MS,SETTLE_MS,STREAM_END,STREAM_START,TRANSFER_END,TRANSFER_START,SURFACE_SAMPLES } from './constants.ts';
import { clamp01,invalidFeedbackPose,movingPose,position,pourDirection,pouringLip,selectedPose,selectedPoseDerivative,smooth,smoother,streamControl,type Pose } from './geometry.ts';
import { liquidLevel,liquidTop,sampleAreaPreservingSurface,sampleSurface } from './liquidMath.ts';
import {prepareSurfaceContact} from './contact.ts';
import {clone,isBottleComplete,pour} from './rules.ts';
import {CAP_ENTER_MS,CAP_EXIT_MS,CAP_FIRST_IMPACT_MS,COMPLETION_FX_MS,completionWaveAt,sampleCap,sampleCompletion,type CapMotion,type CompletionMotion} from './capMotion.ts';
import type {FlightFrame,GlassFrame,LiquidLayerFrame,ReceiverResponseFrame,RenderFrame,StreamFrame} from './RenderFrame.ts';
import {validateModelState,type ModelState} from './modelState.ts';

type Flight={id:number;source:number;target:number;before:number[][];amount:number;color:number;started:number;kind:'pour'|'undo';presentation:FlightFrame;stream:StreamFrame;tail?:Pick<StreamFrame,'start'|'control'|'end'>;tailProfile?:SceneProfile};
type MoveHistory={source:number;target:number;color:number;amount:number;beforeSource:readonly number[];beforeTarget:readonly number[];afterSource:readonly number[];afterTarget:readonly number[]};
type Invalid={source:number;target:number;direction:number;started:number};
type Pulse={index:number;started:number};
type SurfaceState={angle:number;wave:number;phase:number};
type SurfaceCorrection={started:number;duration:number;angle:number;wave:number;phase:number;dAngle:number;dWave:number;dPhase:number};
type Settle={source:number;target:number;started:number;surfaces:SurfaceState[]};
type Hint={source:number;target:number;started:number};
type PoseCorrection={started:number;duration:number;dx:number;dy:number;da:number;dvx:number;dvy:number;dva:number};
type EventKinematics={pose:Pose;velocity:Pose};

const damped=(phase:number,decay:number)=>Math.sin(phase)*Math.exp(-decay);
const transferAt=(p:number)=>smooth((p-TRANSFER_START)/(TRANSFER_END-TRANSFER_START));
// Finish the eased volume transfer at 420 ms, leaving 100 ms for surface recovery.
const UNDO_TRANSFER_END=420/UNDO_MS;
const undoTransferAt=(p:number)=>smoother(p/UNDO_TRANSFER_END);
const HINT_TARGET_DELAY_MS=80,HINT_FADE_IN_MS=70,HINT_FADE_OUT_MS=120;
const SURFACE_DERIVATIVE_STEP=.05;
const UNDO_HISTORY_LIMIT=64;
const RESPONSE_TAPER_START=.55;
const RESPONSE_TAPER_Q=(RESPONSE_TAPER_START-TRANSFER_START)/(TRANSFER_END-TRANSFER_START);
const RESPONSE_TAPER_VALUE=4*RESPONSE_TAPER_Q*(1-RESPONSE_TAPER_Q);
const RESPONSE_TAPER_VELOCITY=4*(1-2*RESPONSE_TAPER_Q)/(TRANSFER_END-TRANSFER_START);
function hintStrength(hint:Hint|null,index:number,now:number,duration=HINT_ATTENTION_MS,delay=HINT_TARGET_DELAY_MS){
  if(!hint||index!==hint.source&&index!==hint.target)return 0;
  const elapsed=now-hint.started-(index===hint.target?delay:0);
  return smooth(elapsed/HINT_FADE_IN_MS)*(1-smooth((now-hint.started-(duration-HINT_FADE_OUT_MS))/HINT_FADE_OUT_MS));
}
function hintStrengthVelocity(hint:Hint|null,index:number,now:number,duration=HINT_ATTENTION_MS,delay=HINT_TARGET_DELAY_MS){
  if(!hint||index!==hint.source&&index!==hint.target)return 0;
  const elapsed=now-hint.started-(index===hint.target?delay:0),fade=now-hint.started-(duration-HINT_FADE_OUT_MS);
  const a=clamp01(elapsed/HINT_FADE_IN_MS),b=clamp01(fade/HINT_FADE_OUT_MS);
  const da=elapsed>0&&elapsed<HINT_FADE_IN_MS?6*a*(1-a)/HINT_FADE_IN_MS:0;
  const db=fade>0&&fade<HINT_FADE_OUT_MS?6*b*(1-b)/HINT_FADE_OUT_MS:0;
  return da*(1-smooth(b))-smooth(a)*db;
}
const invalidStrength=(p:number)=>smooth(p/.12)*(1-smooth((p-.62)/.38));
function receiverResponseAt(p:number){
  if(p<=TRANSFER_START||p>=1)return 0;
  if(p<=RESPONSE_TAPER_START){const q=(p-TRANSFER_START)/(TRANSFER_END-TRANSFER_START);return 4*q*(1-q);}
  return Math.max(0,correctionValue(RESPONSE_TAPER_VALUE,RESPONSE_TAPER_VELOCITY,p-RESPONSE_TAPER_START,1-RESPONSE_TAPER_START));
}
function flightSurface(active:Flight,index:number,now:number,out:SurfaceState,direction=pourDirection(active.source,active.target)){
  const p=clamp01((now-active.started)/POUR_MS);
  out.angle=0;out.wave=0;out.phase=now*.018;
  if(index===active.source){
    const departure=Math.sin(Math.PI*smoother(p/.58));
    out.angle=direction*(-.047*departure+.025*smoother((p-.58)/.20)*(1-.16*smoother((p-.82)/.18)));
    out.wave=1.5*smoother(p/.20)*(1-.45*smoother((p-.70)/.30));
  }else if(index===active.target){
    const arrival=smoother((p-TRANSFER_START)/.22),follow=1-.25*smoother((p-.72)/.28);
    out.angle=direction*.018*arrival*follow;
    out.wave=1.6*smoother((p-TRANSFER_START)/.23)*(1-.35*smoother((p-.70)/.30));
    out.phase-=5*transferAt(p);
  }
  return out;
}
function undoSurface(active:Flight,index:number,now:number,out:SurfaceState){
  if(index!==active.source&&index!==active.target){out.angle=0;out.wave=0;out.phase=now*.018;return out;}
  const p=clamp01((now-active.started)/UNDO_MS);
  const t=clamp01(p/UNDO_TRANSFER_END),q=clamp01((p-300/UNDO_MS)/(1-300/UNDO_MS));
  // A speed-shaped response followed by one smaller, opposite lean; both end at rest.
  const response=16*t*t*(1-t)*(1-t),rebound=16*q*q*(1-q)*(1-q);
  const refilling=index===active.target;
  out.angle=(refilling?.016:-.009)*response-(refilling?.004:-.0025)*rebound;
  out.wave=(refilling?1.7:1.0)*response+(refilling?.3:.16)*rebound;
  out.phase=active.started*.018+p*UNDO_MS*.010+(refilling?-1.1:.85)*undoTransferAt(p);
  return out;
}
function zeroPose(out:Pose){out.x=0;out.y=0;out.angle=0;return out;}
function correctionValue(offset:number,velocity:number,elapsed:number,duration:number){const u=clamp01(elapsed/duration),u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*offset+(u3-2*u2+u)*duration*velocity;}
function correctionVelocity(offset:number,velocity:number,elapsed:number,duration:number){const u=clamp01(elapsed/duration),u2=u*u;return(6*u2-6*u)/duration*offset+(3*u2-4*u+1)*velocity;}

const makeLayer=():LiquidLayerFrame=>({color:0,amount:0,bottom:0,top:0,isTop:false,wavy:false,surface:new Float64Array(SURFACE_SAMPLES*2)});
const makeParticle=()=>({visible:false,x:0,y:0,radius:0,alpha:0,bubble:false,color:0});
const makeGlassFrame=(index:number):GlassFrame=>({index,pose:{x:0,y:0,angle:0},surfaceAngle:0,relativeLiquidRotation:0,wave:0,phase:0,dynamicLiquid:false,layers:[],contact:{local:{x:0,y:0},world:{x:0,y:0},tangent:{x:1,y:0},empty:true},response:null,cap:{visible:false,alpha:1,y:1,scaleX:1,scaleY:1,rotation:0},completion:{recoilY:0,color:0,particles:Array.from({length:12},makeParticle)},droplets:Array.from({length:6},makeParticle),selected:false,hintRole:null,hintStrength:0,invalid:false,invalidRole:null,invalidStrength:0,moving:false,time:0,reducedMotion:false,selectionStrength:0,completionAge:null});
const makeSurfaceState=():SurfaceState=>({angle:0,wave:0,phase:0});
const makeStreamFrame=():StreamFrame=>({id:0,source:0,target:0,visible:true,color:0,alpha:0,reveal:0,release:0,widthScale:1,start:{x:0,y:0},control:{x:0,y:0},end:{x:0,y:0}});
const makeEventKinematics=():EventKinematics=>({pose:{x:0,y:0,angle:0},velocity:{x:0,y:0,angle:0}});

export class StilllightModel{
  geometry=sceneGeometry();
  setPresentationGeometry(profile:SceneProfile){this.geometry=sceneGeometry(profile);}
  private get selectionMs(){return this.geometry.selectMs;}
  private get hintMs(){return this.geometry.profile?(this.reducedMotion?1400:2400):HINT_ATTENTION_MS;}
  private resetDipAt:number|null=null;
  private resetPresentationAt:number|null=null;
  private capImpactAt:(number|null)[]=[];
  private selectionExitAt:(number|null)[]=[];
  private undoShimmer:Hint|null=null;
  private hintCancel:{source:number;target:number;started:number;sourceStrength:number;targetStrength:number}|null=null;
  showResetDip(now:number){this.resetDipAt=this.geometry.profile&&!this.reducedMotion?now:null;}
  private attention(index:number,now:number){
    if(!this.geometry.profile)return hintStrength(this.hintMotion,index,now);
    const h=this.hintMotion;if(!h){const cancelled=this.hintCancel;if(!cancelled||index!==cancelled.source&&index!==cancelled.target)return 0;return (index===cancelled.source?cancelled.sourceStrength:cancelled.targetStrength)*(1-smooth((now-cancelled.started)/160));}if(index!==h.source&&index!==h.target)return 0;const t=now-h.started;
    if(this.reducedMotion)return t>=0&&t<1400?.35*(1-smooth((t-1200)/200)):0;
    const elapsed=t-(index===h.target?420:0);if(elapsed<0||t>=this.hintMs)return 0;
    const pulse=elapsed<220?smooth(elapsed/220):elapsed<800?1-.45*smooth((elapsed-220)/580):.55+.15*(.5-.5*Math.cos((elapsed-800)*2*Math.PI/1100));
    const landing=index===h.target?.15*Math.sin(Math.PI*clamp01((t-700)/160)):0;
    return (pulse+landing)*(1-smooth((t-2100)/300));
  }
  private dip(index:number,now:number,derivative=false){
    if(this.resetDipAt===null||this.reducedMotion)return 0;const t=now-this.resetDipAt-index*30;if(t<0||t>=260)return 0;const a=6/(this.geometry.profile?.pixelScale??1);return derivative?a*Math.PI/260*Math.cos(Math.PI*t/260):a*Math.sin(Math.PI*t/260);
  }
  private cancelResetDip(now:number){if(this.resetDipAt===null)return;this.capturePair(now);this.resetDipAt=null;for(let i=0;i<this.board.length;i++){zeroPose(this.targetVelocity);this.beginCorrection(i,now,140,this.targetVelocity);}}
  board=clone(INITIAL);
  private boardFrame=clone(INITIAL);
  selected:number|null=null;
  private activeFlights:Flight[]=[];
  private settlingPairs:Settle[]=[];
  private nextFlightId=1;
  get flights():readonly Flight[]{return this.activeFlights;}
  get flight():Flight|null{return this.activeFlights[0]??null;}
  get settleMotion():Settle|null{return this.settlingPairs[0]??null;}
  get busy(){return this.activeFlights.length>0||!!this.invalidMotion;}
  invalidMotion:Invalid|null=null;
  selectionPulse:Pulse|null=null;
  hintMotion:Hint|null=null;
  invalidSource:number|null=null;
  invalidTarget:number|null=null;
  events:readonly string[]=[];
  eventCount=0;
  reducedMotion=false;

  private layerSlots=[[makeLayer(),makeLayer(),makeLayer(),makeLayer(),makeLayer()],[makeLayer(),makeLayer(),makeLayer(),makeLayer(),makeLayer()]];
  private glassFrames:GlassFrame[]=[makeGlassFrame(0),makeGlassFrame(1)];
  private receiverResponses:ReceiverResponseFrame[]=[];
  private frame:RenderFrame={now:0,board:this.boardFrame,glasses:this.glassFrames,flights:[],streams:[],stream:null,events:this.events,metrics:{pourProgress:0,transfer:0,settleProgress:0}};
  private poseCorrections:(PoseCorrection|null)[]=[null,null];
  private surfaceCorrections:(SurfaceCorrection|null)[]=[null,null];
  private surfaceStates:(SurfaceState)[]=[makeSurfaceState(),makeSurfaceState()];
  private surfaceCaptures:(SurfaceState)[]=[makeSurfaceState(),makeSurfaceState()];
  private surfaceVelocities:(SurfaceState)[]=[makeSurfaceState(),makeSurfaceState()];
  private surfaceBefore=makeSurfaceState();
  private surfaceTarget=makeSurfaceState();
  private surfaceTargetAfter=makeSurfaceState();
  private eventKinematics:(EventKinematics)[]=[makeEventKinematics(),makeEventKinematics()];
  private targetPose:Pose={x:0,y:0,angle:0};
  private targetVelocity:Pose={x:0,y:0,angle:0};
  private moveHistory:MoveHistory[]=[];
  private acceptedHistory:MoveHistory[]=[];
  private capComplete:(boolean)[]=[isBottleComplete(INITIAL[0]),isBottleComplete(INITIAL[1])];
  private capMotions:(CapMotion|null)[]=[null,null];
  private completionMotions:(CompletionMotion|null)[]=[null,null];

  private initial:number[][];
  constructor(initial:number[][]=INITIAL){
    this.initial=clone(initial);
    this.board=clone(initial);this.boardFrame=clone(initial);
    this.layerSlots=initial.map(()=>Array.from({length:5},makeLayer));
    this.glassFrames=initial.map((_,i)=>makeGlassFrame(i));
    this.poseCorrections=initial.map(()=>null);this.surfaceCorrections=initial.map(()=>null);
    this.surfaceStates=initial.map(makeSurfaceState);this.surfaceCaptures=initial.map(makeSurfaceState);this.surfaceVelocities=initial.map(makeSurfaceState);
    this.eventKinematics=initial.map(makeEventKinematics);
    this.capComplete=initial.map(isBottleComplete);this.capMotions=initial.map(()=>null);this.completionMotions=initial.map(()=>null);
    this.frame.glasses=this.glassFrames;
    this.capImpactAt=initial.map(()=>null);this.selectionExitAt=initial.map(()=>null);
    this.receiverResponses=this.glassFrames.map(g=>({contact:g.contact,intensity:0,spread:0}));
  }

  get undoDepth(){return this.moveHistory.length;}
  get moveCount(){return this.acceptedHistory.length;}

  exportState():ModelState{return structuredClone({board:this.board,history:this.acceptedHistory});}
  restoreState(value:unknown){
    const state=validateModelState(value,this.initial);
    this.reset();this.board=state.board;this.boardFrame=clone(state.board);this.acceptedHistory=state.history;this.moveHistory=state.history.slice(-UNDO_HISTORY_LIMIT);
    this.capComplete=this.board.map(isBottleComplete);
  }

  showHint(source:number,target:number,now:number){
    if(this.busy||this.settleMotion||!pour(this.board,source,target))return false;
    this.cancelResetDip(now);this.capturePair(now);const selected=this.selected;
    this.selected=null;this.selectionPulse=null;this.hintCancel=null;this.hintMotion={source,target,started:now};
    if(selected!==null){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    this.record('hint-start');return true;
  }

  private flightFor(index:number){return this.activeFlights.find(f=>f.source===index||f.target===index)??null;}
  private settleFor(index:number){return this.settlingPairs.find(s=>s.source===index||s.target===index)??null;}
  isVesselAvailable(index:number){
    return Number.isInteger(index)&&!!this.board[index]&&!this.activeFlights.some(f=>f.kind==='undo')&&
      !this.flightFor(index)&&!this.settleFor(index)&&
      !(this.invalidMotion&&(index===this.invalidMotion.source||index===this.invalidMotion.target));
  }
  private acceptFlight(source:number,target:number,before:number[][],amount:number,color:number,started:number,kind:'pour'|'undo'){
    const id=this.nextFlightId++,stream=makeStreamFrame();Object.assign(stream,{id,source,target});
    const presentation:FlightFrame={id,source,target,kind,progress:0,transfer:0,stream:null};
    this.activeFlights.push({id,source,target,before,amount,color,started,kind,presentation,stream});
  }

  canUndo(now:number){
    const entry=this.moveHistory.at(-1);if(this.busy||this.settleMotion||!entry||!this.historyMatches(entry))return false;
    for(let i=0;i<this.board.length;i++){
      const home=this.geometry.position(i),pose=this.poseAt(i,now,this.targetPose),v=this.velocityAt(i,now,this.targetVelocity);
      if(Math.abs(pose.x-home.x)+Math.abs(pose.y-home.y)+Math.abs(pose.angle)+Math.abs(v.x)+Math.abs(v.y)+Math.abs(v.angle)>1e-7)return false;
    }
    return true;
  }

  private transitionCaps(before:readonly (readonly number[])[],after:readonly (readonly number[])[],now:number,entry:boolean,indices:readonly number[]=this.board.map((_,i)=>i)){
    for(const index of indices){
      const was=isBottleComplete(before[index]),next=isBottleComplete(after[index]);
      if(entry){if(!was&&next){this.capComplete[index]=true;this.capMotions[index]={kind:'enter',started:now};this.capImpactAt[index]=now+CAP_FIRST_IMPACT_MS;this.completionMotions[index]={impactAt:now+CAP_FIRST_IMPACT_MS,color:after[index][0],recorded:false};}}
      else if(was&&!next){const from=sampleCap(this.capComplete[index],this.capMotions[index],now,{visible:false,alpha:1,y:1,scaleX:1,scaleY:1,rotation:0});this.capComplete[index]=false;this.capMotions[index]={kind:'exit',started:now,from};this.completionMotions[index]=null;}
    }
  }

  private record(...items:string[]){this.eventCount+=items.length;const next=[...this.events,...items];this.events=next.length>32?next.slice(-32):next;}

  private rememberMove(source:number,target:number,color:number,amount:number,before:number[][],after:number[][]){
    const entry:MoveHistory=Object.freeze({source,target,color,amount,
      beforeSource:Object.freeze([...before[source]]),beforeTarget:Object.freeze([...before[target]]),
      afterSource:Object.freeze([...after[source]]),afterTarget:Object.freeze([...after[target]])});
    if(this.moveHistory.length===UNDO_HISTORY_LIMIT)this.moveHistory.shift();
    this.moveHistory.push(entry);this.acceptedHistory.push(entry);
  }

  private capturePair(now:number){for(let i=0;i<this.board.length;i++)this.capturePresented(i,now);}

  private continueClearedOthers(except:number[],now:number,hint:Hint|null,settle:Settle|null){for(let i=0;i<this.board.length;i++)if(!except.includes(i))this.continueClearedPartner(i,now,hint,settle); }

  private continueClearedPartner(index:number,now:number,hint:Hint|null,settle:Settle|null){
    if(this.flightFor(index)||this.settleFor(index))return;
    const duration=Math.max(hint?DESELECT_RETURN_MS:0,settle?Math.max(0,settle.started+SETTLE_MS-now):0);
    if(duration<=0)return;
    this.velocityAt(index,now,this.targetVelocity,false);
    this.beginCorrection(index,now,duration,this.targetVelocity);
  }

  private historyMatches(entry:MoveHistory){
    const same=(actual:readonly number[]|undefined,expected:readonly number[])=>actual?.length===expected.length&&actual.every((color,index)=>color===expected[index]);
    return same(this.board[entry.source],entry.afterSource)&&same(this.board[entry.target],entry.afterTarget);
  }

  private applyCorrection(index:number,now:number,out:Pose){
    const correction=this.poseCorrections[index];if(!correction)return out;
    const elapsed=now-correction.started;if(elapsed<0||elapsed>=correction.duration)return out;
    out.x+=correctionValue(correction.dx,correction.dvx,elapsed,correction.duration);
    out.y+=correctionValue(correction.dy,correction.dvy,elapsed,correction.duration);
    out.angle+=correctionValue(correction.da,correction.dva,elapsed,correction.duration);
    return out;
  }

  private applyCorrectionVelocity(index:number,now:number,out:Pose){
    const correction=this.poseCorrections[index];if(!correction)return out;
    const elapsed=now-correction.started;if(elapsed<0||elapsed>=correction.duration)return out;
    out.x+=correctionVelocity(correction.dx,correction.dvx,elapsed,correction.duration);
    out.y+=correctionVelocity(correction.dy,correction.dvy,elapsed,correction.duration);
    out.angle+=correctionVelocity(correction.da,correction.dva,elapsed,correction.duration);
    return out;
  }

  private poseAt(index:number,now:number,out:Pose,includeCorrection=true){
    if(this.reducedMotion){this.geometry.position(index,out);if(this.selected===index){const p=this.selectionPulse?.index===index?smooth((now-this.selectionPulse.started)/120):1;out.y-=8*this.geometry.localScale(index)*p;}out.angle=0;return out;}
    const active=this.flightFor(index),invalid=this.invalidMotion,pulse=this.selectionPulse,hint=this.hintMotion;
    const progress=active?clamp01((now-active.started)/POUR_MS):0,transfer=active?transferAt(progress):0,invalidProgress=invalid?clamp01((now-invalid.started)/INVALID_MS):0,pulseProgress=pulse?clamp01((now-pulse.started)/this.selectionMs):0;
    const moving=active?.kind==='pour'&&active.source===index;
    this.geometry.position(index,out);out.angle=0;
    if(moving&&active){const remainingUnits=active.before[active.source].length-active.amount*transfer;this.geometry.movingPose(active.source,active.target,progress,remainingUnits,out);}
    else if(invalid&&index===invalid.source)this.geometry.invalidFeedbackPose(index,invalidProgress,invalid.direction,out);
    else if(this.selected===index)this.geometry.selectedPose(index,pulse?.index===index?pulseProgress:1,out);
    if(active?.kind==='pour'&&active.target===index)out.y+=Math.min(1.8,.6*active.amount)*Math.sin(Math.PI*transfer);
    if(active?.kind==='undo')out.y+=2*Math.sin(Math.PI*clamp01((now-active.started)/120));
    if(invalid?.target===index)out.y+=1.5*Math.sin(Math.PI*invalidProgress);
    if(!moving&&!invalid&&hint)out.y-=(hint.source===index?3:hint.target===index?2:0)*this.attention(index,now);
    out.y+=this.dip(index,now);
    if(includeCorrection)this.applyCorrection(index,now,out);
    return out;
  }

  private velocityAt(index:number,now:number,out:Pose,includeCorrection=true){
    zeroPose(out);
    if(this.reducedMotion)return out;
    const active=this.flightFor(index),invalid=this.invalidMotion?.source===index?this.invalidMotion:null,pulse=this.selectionPulse,hint=this.hintMotion,moving=active?.kind==='pour'&&active.source===index;
    if(!active&&!invalid&&this.selected===index&&pulse?.index===index){const raw=(now-pulse.started)/this.selectionMs;if(raw>=0&&raw<1){this.geometry.selectedPoseDerivative(raw,out,index);out.y/=this.selectionMs;}}
    if(!moving&&!invalid&&hint)out.y-=(hint.source===index?3:hint.target===index?2:0)*(this.geometry.profile?(this.attention(index,now+.05)-this.attention(index,now-.05))/.1:hintStrengthVelocity(hint,index,now));
    out.y+=this.dip(index,now,true);
    if(includeCorrection)this.applyCorrectionVelocity(index,now,out);
    return out;
  }

  private surfaceAt(index:number,now:number,out:SurfaceState,includeCorrection=true){
    if(this.reducedMotion){out.angle=0;out.wave=0;out.phase=now*.018;return out;}
    const active=this.flightFor(index),invalid=this.invalidMotion,pulse=this.selectionPulse,settle=this.settleFor(index);
    out.angle=0;out.wave=0;out.phase=now*.018;
    if(active?.kind==='pour')flightSurface(active,index,now,out,this.geometry.pourDirection(active.source,active.target));
    else if(active?.kind==='undo')undoSurface(active,index,now,out);
    else if(invalid&&index===invalid.source){const p=clamp01((now-invalid.started)/INVALID_MS),envelope=Math.sin(Math.PI*p);out.angle=-invalid.direction*.026*envelope*envelope;out.wave=1.15*envelope*envelope;}
    else if(this.selected===index&&pulse?.index===index){const p=clamp01((now-pulse.started)/this.selectionMs);if(p<1){out.angle=.018*damped(p*Math.PI*4.5,p*2.4);out.wave=1.65*Math.sin(Math.PI*p)*Math.exp(-p*.8);}}
    else if(settle&&(index===settle.source||index===settle.target)){
      const p=clamp01((now-settle.started)/SETTLE_MS),inherited=settle.surfaces[index];
      const envelope=1-smoother(p);out.angle=inherited.angle*envelope;out.wave=inherited.wave*envelope;out.phase=inherited.phase+(now-settle.started)*.018;
    }
    const correction=includeCorrection?this.surfaceCorrections[index]:null;
    if(correction&&now>=correction.started&&now<correction.started+correction.duration){
      const elapsed=now-correction.started;
      out.angle+=correctionValue(correction.angle,correction.dAngle,elapsed,correction.duration);
      out.wave+=correctionValue(correction.wave,correction.dWave,elapsed,correction.duration);
      out.phase+=correctionValue(correction.phase,correction.dPhase,elapsed,correction.duration);
    }
    const impact=this.completionMotions[index],impulse=completionWaveAt(impact,now);
    out.wave=Math.max(0,out.wave+impulse);
    if(this.resetPresentationAt!==null)out.wave+=1.2*Math.sin(Math.PI*clamp01((now-this.resetPresentationAt-60)/300));
    if(impulse>0&&impact)out.phase+=(now-impact.impactAt)*.025;
    return out;
  }

  private capturePresented(index:number,now:number){
    const capture=this.eventKinematics[index];this.poseAt(index,now,capture.pose,true);this.velocityAt(index,now,capture.velocity,true);
    const surface=this.surfaceCaptures[index],velocity=this.surfaceVelocities[index];
    this.surfaceAt(index,now,surface,true);this.surfaceAt(index,now-SURFACE_DERIVATIVE_STEP,this.surfaceBefore,true);
    velocity.angle=(surface.angle-this.surfaceBefore.angle)/SURFACE_DERIVATIVE_STEP;
    velocity.wave=(surface.wave-this.surfaceBefore.wave)/SURFACE_DERIVATIVE_STEP;
    velocity.phase=(surface.phase-this.surfaceBefore.phase)/SURFACE_DERIVATIVE_STEP;
  }

  private beginSurfaceCorrection(index:number,now:number,duration:number){
    const captured=this.surfaceCaptures[index],velocity=this.surfaceVelocities[index];
    this.surfaceAt(index,now,this.surfaceTarget,false);
    this.surfaceAt(index,now+SURFACE_DERIVATIVE_STEP,this.surfaceTargetAfter,false);
    const target=this.surfaceTarget,after=this.surfaceTargetAfter;
    const angle=captured.angle-target.angle,wave=captured.wave-target.wave,phase=captured.phase-target.phase;
    const dAngle=velocity.angle-(after.angle-target.angle)/SURFACE_DERIVATIVE_STEP;
    const dWave=velocity.wave-(after.wave-target.wave)/SURFACE_DERIVATIVE_STEP;
    const dPhase=velocity.phase-(after.phase-target.phase)/SURFACE_DERIVATIVE_STEP;
    if(Math.abs(angle)+Math.abs(wave)+Math.abs(phase)+duration*(Math.abs(dAngle)+Math.abs(dWave)+Math.abs(dPhase))<1e-9){this.surfaceCorrections[index]=null;return;}
    this.surfaceCorrections[index]={started:now,duration,angle,wave,phase,dAngle,dWave,dPhase};
  }

  private beginCorrection(index:number,now:number,duration:number,targetVelocity:Pose){
    this.beginSurfaceCorrection(index,now,duration);
    const capture=this.eventKinematics[index];this.poseAt(index,now,this.targetPose,false);
    const dx=capture.pose.x-this.targetPose.x,dy=capture.pose.y-this.targetPose.y,da=capture.pose.angle-this.targetPose.angle,dvx=capture.velocity.x-targetVelocity.x,dvy=capture.velocity.y-targetVelocity.y,dva=capture.velocity.angle-targetVelocity.angle;
    if(Math.abs(dx)+Math.abs(dy)+Math.abs(da)+duration*(Math.abs(dvx)+Math.abs(dvy)+Math.abs(dva))<1e-9){this.poseCorrections[index]=null;return;}
    this.poseCorrections[index]={started:now,duration,dx,dy,da,dvx,dvy,dva};
  }

  reset(now?:number){
    const caps=now!==undefined&&!this.reducedMotion?this.board.map((_,i)=>structuredClone(sampleCap(this.capComplete[i],this.capMotions[i],now,{visible:false,alpha:1,y:16,scaleX:1,scaleY:1,rotation:0}))):null;
    this.board=clone(this.initial);this.boardFrame=clone(this.board);this.selected=null;this.activeFlights.length=0;this.settlingPairs.length=0;this.invalidMotion=this.selectionPulse=this.hintMotion=null;this.invalidSource=this.invalidTarget=null;this.poseCorrections.fill(null);this.surfaceCorrections.fill(null);this.capComplete=this.board.map(isBottleComplete);this.capMotions.fill(null);this.completionMotions.fill(null);this.moveHistory.length=0;this.acceptedHistory.length=0;this.events=['reset'];this.resetDipAt=null;this.undoShimmer=null;
    this.capImpactAt.fill(null);this.selectionExitAt.fill(null);this.resetPresentationAt=null;this.hintCancel=null;
    if(now!==undefined&&!this.reducedMotion){this.resetPresentationAt=now;this.showResetDip(now);if(caps)this.capMotions=caps.map(from=>from.visible?{kind:'exit',started:now,from}:null);}
  }

  cancelHint(now:number){
    const hint=this.hintMotion;if(!hint)return;this.capturePair(now);this.hintCancel={...hint,sourceStrength:this.attention(hint.source,now),targetStrength:this.attention(hint.target,now)};this.hintMotion=null;
    for(const i of [hint.source,hint.target]){zeroPose(this.targetVelocity);this.beginCorrection(i,now,160,this.targetVelocity);}
  }

  private freezeStreamTail(active:Flight,receiver:GlassFrame){
    if(active.tail&&active.tailProfile===this.geometry.profile){Object.assign(active.stream.start,active.tail.start);Object.assign(active.stream.control,active.tail.control);Object.assign(active.stream.end,active.tail.end);return;}
    const at=active.started+STREAM_END*POUR_MS,source=this.poseAt(active.source,at,{x:0,y:0,angle:0}),target=structuredClone(receiver),surface=this.surfaceAt(active.target,at,makeSurfaceState());
    this.poseAt(active.target,at,target.pose);target.relativeLiquidRotation=-target.pose.angle+surface.angle;
    const top=target.layers.at(-1);if(top?.surface)sampleSurface(top.top,surface.wave,surface.phase,top.surface);
    this.geometry.pouringLip(source,this.geometry.pourDirection(active.source,active.target),active.stream.start,active.source);
    prepareSurfaceContact(target,this.geometry.pourDirection(active.source,active.target),target.contact,active.stream.start.x,this.geometry.localScale(active.target));
    Object.assign(active.stream.end,target.contact.world);streamControl(active.stream.start,active.stream.end,1,active.stream.control);
    active.tail={start:{...active.stream.start},control:{...active.stream.control},end:{...active.stream.end}};active.tailProfile=this.geometry.profile;
  }

  previewCompletedRight(now:number){
    this.reset();
    const before=this.board;
    this.board=clone(before);this.board[1]=[3,3,3,3];this.boardFrame=clone(this.board);
    this.transitionCaps(before,this.board,now,true);
  }

  choose(index:number,now:number){
    if(!this.isVesselAvailable(index))return;
    this.cancelResetDip(now);const source=this.selected;
    if(source===null){
      if(this.board[index].length){
        const hint=this.hintMotion;
        this.capturePair(now);
        this.selected=index;this.selectionPulse={index,started:now};this.hintMotion=null;
        this.velocityAt(index,now,this.targetVelocity,false);this.beginCorrection(index,now,this.selectionMs,this.targetVelocity);
        this.continueClearedOthers([index],now,hint,null);
        this.record(`selected:${index}`);
      }
      return;
    }
    if(source===index){this.capturePresented(source,now);this.selected=null;this.selectionPulse=null;this.velocityAt(source,now,this.targetVelocity,false);this.beginCorrection(source,now,DESELECT_RETURN_MS,this.targetVelocity);this.record('selection-cleared');return;}
    const result=pour(this.board,source,index);
    if(!result){
      if(this.invalidMotion)return;
      const direction=this.geometry.position(index).x>=this.geometry.position(source).x?1:-1,hint=this.hintMotion;
      this.capturePair(now);
      this.selected=null;this.selectionPulse=null;this.hintMotion=null;
      this.invalidSource=source;this.invalidTarget=index;this.invalidMotion={source,target:index,direction,started:now};
      zeroPose(this.targetVelocity);this.beginCorrection(source,now,INVALID_MS,this.targetVelocity);
      this.continueClearedOthers([source],now,hint,null);
      this.record(`invalid:${source}->${index}`);return;
    }
    const hint=this.hintMotion;
    this.capturePair(now);
    const before=clone(this.board);
    this.selected=null;this.selectionPulse=null;
    this.acceptFlight(source,index,before,result.amount,result.color,now,'pour');
    this.board=result.board;this.boardFrame=clone(this.board);this.transitionCaps(before,this.board,now,false,[source,index]);
    this.rememberMove(source,index,result.color,result.amount,before,this.board);
    zeroPose(this.targetVelocity);this.beginCorrection(source,now,DEPARTURE_BLEND_MS,this.targetVelocity);
    this.continueClearedOthers([source,index],now,hint,null);
    this.record(`pour-start:${source}->${index}`);
  }

  undo(now:number){
    if(this.busy||this.settleMotion)return false;
    const entry=this.moveHistory.at(-1);
    if(!entry||!this.historyMatches(entry))return false;
    this.capturePair(now);
    for(let index=0;index<this.board.length;index++){
      const home=this.geometry.position(index),{pose,velocity}=this.eventKinematics[index];
      if(Math.abs(pose.x-home.x)+Math.abs(pose.y-home.y)+Math.abs(pose.angle)+
        Math.abs(velocity.x)+Math.abs(velocity.y)+Math.abs(velocity.angle)>1e-7)return false;
    }
    const before=clone(this.board);
    const restored=clone(this.board);
    restored[entry.source]=[...entry.beforeSource];restored[entry.target]=[...entry.beforeTarget];
    this.moveHistory.pop();
    this.acceptedHistory.pop();
    this.undoShimmer=this.geometry.profile?{source:entry.source,target:entry.target,started:now}:null;
    this.selected=null;this.selectionPulse=null;this.hintMotion=null;
    this.invalidSource=this.invalidTarget=null;
    this.acceptFlight(entry.target,entry.source,before,entry.amount,entry.color,now,'undo');
    this.board=restored;this.boardFrame=clone(restored);this.transitionCaps(before,restored,now,false);
    this.poseCorrections.fill(null);
    for(let i=0;i<this.board.length;i++)this.beginSurfaceCorrection(i,now,UNDO_MS);
    this.record(`undo-start:${entry.target}->${entry.source}`);
    return true;
  }

  hint(now:number){
    if(this.busy||this.settleMotion||this.hintMotion&&now-this.hintMotion.started<this.hintMs)return;
    let pair:Hint|null=null,best=-Infinity;
    for(let source=0;source<this.board.length;source++)for(let target=0;target<this.board.length;target++){
      if(isBottleComplete(this.board[source]))continue;
      const result=pour(this.board,source,target);if(!result)continue;
      if(!this.board[target].length&&result.amount===this.board[source].length)continue;
      const score=(this.board[target].length?10:0)+result.amount+(isBottleComplete(result.board[target])?20:0);
      if(score>best){best=score;pair={source,target,started:now};}
    }
    if(pair){this.hintMotion=pair;this.record('hint-start');}
  }

  invalid(now:number){
    if(this.busy)return;
    const selected=this.selected,hint=this.hintMotion;
    this.capturePair(now);
    if(!this.isVesselAvailable(0)||!this.isVesselAvailable(1))return;
    this.selected=null;this.selectionPulse=null;this.hintMotion=null;this.invalidSource=0;this.invalidTarget=1;this.invalidMotion={source:0,target:1,direction:1,started:now};
    zeroPose(this.targetVelocity);this.beginCorrection(0,now,INVALID_MS,this.targetVelocity);
    if(selected!==null&&selected!==0){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    else this.continueClearedPartner(1,now,hint,null);
    this.record('invalid:0->1');
  }

  startPour(now:number){
    if(!this.isVesselAvailable(0)||!this.isVesselAvailable(1))return false;const result=pour(this.board,0,1);if(!result)return false;
    const selected=this.selected;this.capturePair(now);
    const before=clone(this.board);this.acceptFlight(0,1,before,result.amount,result.color,now,'pour');this.board=result.board;this.boardFrame=clone(this.board);this.selected=null;this.transitionCaps(before,this.board,now,false,[0,1]);
    this.rememberMove(0,1,result.color,result.amount,before,this.board);
    zeroPose(this.targetVelocity);this.beginCorrection(0,now,DEPARTURE_BLEND_MS,this.targetVelocity);
    if(selected!==null&&selected!==0){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    this.record('pour-start:0->1');return true;
  }

  sample(now:number):RenderFrame{
    const active=this.flight,invalid=this.invalidMotion,settling=this.settleMotion,hint=this.hintMotion;
    const progress=active?clamp01((now-active.started)/(active.kind==='undo'?UNDO_MS:POUR_MS)):0,transfer=active?(active.kind==='undo'?undoTransferAt(progress):transferAt(progress)):0,invalidProgress=invalid?clamp01((now-invalid.started)/INVALID_MS):0,settleProgress=settling?clamp01((now-settling.started)/SETTLE_MS):0,activeDirection=active?this.geometry.pourDirection(active.source,active.target):1;

    const makeGlass=(index:number,moving=false)=>{
      const active=this.flightFor(index);
      const progress=active?clamp01((now-active.started)/(active.kind==='undo'?UNDO_MS:POUR_MS)):0;
      const transfer=active?(active.kind==='undo'?undoTransferAt(progress):transferAt(progress)):0;
      const frame=this.glassFrames[index];frame.localScale=this.geometry.localScale(index);
      this.poseAt(index,now,frame.pose,true);
      const surface=this.surfaceAt(index,now,this.surfaceStates[index]);
      const surfaceAngle=surface.angle,wave=surface.wave,phase=surface.phase;
      const dynamicLiquid=surfaceAngle!==0||wave!==0;

      const sourceLayers=(active?active.before:this.board)[index];
      const slots=this.layerSlots[index];
      let layerCount=sourceLayers.length;
      for(let i=0;i<layerCount;i++){const slot=slots[i];slot.color=sourceLayers[i];slot.amount=1;}
      if(active&&index===active.source){let remaining=active.amount*transfer;for(let i=layerCount-1;i>=0&&remaining>(active.kind==='undo'?0:EPSILON);i--){const slot=slots[i],taken=Math.min(remaining,slot.amount);slot.amount-=taken;remaining-=taken;}}
      if(active&&index===active.target){const slot=slots[layerCount++];slot.color=active.color;slot.amount=active.amount*transfer;}

      const relative=frame.pose.angle-surfaceAngle,movingLiquid=dynamicLiquid||frame.pose.angle!==0;
      let total=0,boundary=movingLiquid?liquidLevel(0,relative):158,visibleCount=0;
      for(let i=0;i<layerCount;i++){
        const layer=slots[i];if(layer.amount<=(active?.kind==='undo'?0:EPSILON))continue;
        const bottom=boundary;total+=layer.amount;const top=movingLiquid?liquidLevel(total,relative):liquidTop(total);boundary=top;
        const out=slots[visibleCount];
        if(out!==layer){out.color=layer.color;out.amount=layer.amount;}
        out.bottom=bottom;out.top=top;out.isTop=false;out.wavy=false;
        visibleCount++;
      }
      if(visibleCount){const topLayer=slots[visibleCount-1];topLayer.isTop=true;topLayer.wavy=true;if(completionWaveAt(this.completionMotions[index],now)>0)sampleAreaPreservingSurface(total,surfaceAngle,wave,phase,topLayer.surface!);else sampleSurface(topLayer.top,wave,phase,topLayer.surface!);}
      frame.layers.length=visibleCount;
      for(let i=0;i<visibleCount;i++)frame.layers[i]=slots[i];
      frame.surfaceAngle=surfaceAngle;frame.relativeLiquidRotation=-frame.pose.angle+surfaceAngle;frame.wave=wave;frame.phase=phase;frame.dynamicLiquid=movingLiquid;
      if(frame.selected&&this.selected!==index)this.selectionExitAt[index]=now;
      frame.selected=this.selected===index;frame.selectionStrength=frame.selected?(this.selectionPulse?.index===index?smooth((now-this.selectionPulse.started)/120):1):this.selectionExitAt[index]===null?0:1-smooth((now-this.selectionExitAt[index]!)/160);
      frame.time=now;frame.reducedMotion=this.reducedMotion;frame.completionAge=this.capImpactAt[index]===null?null:now-this.capImpactAt[index]!;
      for(const drop of frame.droplets)drop.visible=false;
      frame.hintStrength=moving?0:this.attention(index,now);
      const hintRole=hint??this.hintCancel;frame.hintRole=frame.hintStrength>0?hintRole?.source===index?'source':hintRole?.target===index?'target':null:null;
      const shimmer=this.undoShimmer;if(shimmer&&(index===shimmer.source||index===shimmer.target)){const t=now-shimmer.started;if(t>=0&&t<400){frame.hintRole='target';frame.hintStrength=.55*Math.sin(Math.PI*t/400);}}
      frame.invalid=this.invalidSource===index||this.invalidTarget===index;
      frame.invalidRole=frame.invalid?(this.invalidSource===index?'source':'target'):null;
      frame.invalidStrength=frame.invalid?invalidStrength(invalidProgress):0;frame.moving=moving;
      sampleCap(this.capComplete[index],this.capMotions[index],now,frame.cap);
      sampleCompletion(this.completionMotions[index],now,frame.completion);
      if(this.reducedMotion){
        frame.moving=false;frame.completion.recoilY=0;for(const p of frame.completion.particles)p.visible=false;
        if(frame.cap.visible){frame.cap.y=16;frame.cap.scaleX=frame.cap.scaleY=1;frame.cap.rotation=0;frame.cap.alpha=this.capMotions[index]?.kind==='enter'?smooth((now-this.capMotions[index]!.started)/160):1;}
      }
      return frame;
    };

    const glasses=this.glassFrames;
    for(let i=0;i<this.board.length;i++){const owned=this.flightFor(i);makeGlass(i,owned?.kind==='pour'&&owned.source===i);prepareSurfaceContact(glasses[i],this.geometry.profile?(this.geometry.position(i).x<this.geometry.profile.width/2?-1:1):i%3===0?-1:1,glasses[i].contact,undefined,this.geometry.localScale(i));}
    for(const glass of glasses)glass.response=null;
    const frame=this.frame;frame.streams.length=0;frame.flights.length=0;
    for(const active of this.activeFlights){
      const progress=clamp01((now-active.started)/(active.kind==='undo'?UNDO_MS:POUR_MS));
      const transfer=active.kind==='undo'?undoTransferAt(progress):transferAt(progress);
      const activeDirection=this.geometry.pourDirection(active.source,active.target);
      const presentation=active.presentation;presentation.progress=progress;presentation.transfer=transfer;presentation.stream=null;
      frame.flights.push(presentation);
    if(active.kind==='pour'){
      const receiver=glasses[active.target];
      const impactX=progress>STREAM_START&&progress<STREAM_END?
        this.geometry.pouringLip(glasses[active.source].pose,activeDirection,active.stream.start,active.source).x:receiver.pose.x;
      prepareSurfaceContact(receiver,activeDirection,receiver.contact,impactX,this.geometry.localScale(active.target));
    }
    let stream:StreamFrame|null=null;
    let responseIntensity=0;
    if(active?.kind==='pour'&&progress>STREAM_START&&progress<1){
      const receiver=glasses[active.target],contact=receiver.contact;
      responseIntensity=receiverResponseAt(progress);
      if(responseIntensity>0){
        const response=this.receiverResponses[active.target];response.contact=contact;response.intensity=responseIntensity;
        response.spread=7+12*smoother((progress-TRANSFER_START)/.50);
        receiver.response=response;
      }
    }
    if(active?.kind==='pour'&&progress>STREAM_START&&progress<(this.reducedMotion?STREAM_END:STREAM_END+.135)){
      const moving=glasses[active.source],contact=glasses[active.target].contact,direction=activeDirection,q=clamp01((progress-STREAM_START)/(STREAM_END-STREAM_START));
      stream=active.stream;
      if(progress>=STREAM_END)this.freezeStreamTail(active,glasses[active.target]);
      else{this.geometry.pouringLip(moving.pose,direction,stream.start,active.source);stream.end.x=contact.world.x;stream.end.y=contact.world.y;streamControl(stream.start,stream.end,direction,stream.control);}
      stream.release=this.reducedMotion?0:smoother((progress-STREAM_END)/.135);
      stream.visible=true;stream.color=active.color;stream.alpha=this.reducedMotion?Math.max(0,Math.min(1,(progress-STREAM_START)*POUR_MS/120,(STREAM_END-progress)*POUR_MS/120)):Math.min(1,q*7)*(1-stream.release);
      stream.reveal=this.reducedMotion?1:1-Math.pow(1-clamp01((progress-STREAM_START)/(TRANSFER_START-STREAM_START)),3);
      stream.widthScale=this.reducedMotion?1:1-.65*stream.release;
      presentation.stream=stream;frame.streams.push(stream);
    }
    if(active.kind==='pour'&&!this.reducedMotion){
      const receiver=glasses[active.target],source=glasses[active.source];
      const launches=[TRANSFER_START*POUR_MS,(TRANSFER_START+TRANSFER_END)*POUR_MS/2];
      for(let i=0;i<5;i++){const batch=i<3?0:1,t=now-active.started-launches[batch],seconds=t/1000,drop=receiver.droplets[i];if(t<0||t>=260)continue;const lane=i%3,side=i%2?1:-1;drop.visible=true;drop.color=active.color;drop.bubble=false;drop.x=receiver.contact.local.x+side*(14+lane*7)*seconds;drop.y=receiver.contact.local.y-(26+lane*9)*seconds+60*seconds*seconds;drop.radius=1.1;drop.alpha=.7*(1-t/260);}
      const t=now-active.started-STREAM_END*POUR_MS,drop=source.droplets[0];if(t>=0&&t<260){drop.visible=true;drop.color=active.color;drop.bubble=false;drop.x=activeDirection*33;drop.y=60*(t/1000)**2;drop.radius=1;drop.alpha=.7*(1-t/260);}
    }
    }
    let remainingParticles=24-(this.hintMotion&&!this.reducedMotion?3:0);for(const glass of glasses)for(const pool of [glass.completion.particles,glass.droplets])for(const particle of pool)if(particle.visible){if(remainingParticles>0)remainingParticles--;else particle.visible=false;}
    frame.now=now;frame.board=this.boardFrame;frame.stream=frame.flights[0]?.stream??null;frame.events=this.events;frame.metrics.pourProgress=progress;frame.metrics.transfer=transfer;frame.metrics.settleProgress=settleProgress;
    return frame;
  }

  advanceAfterFrame(now:number){
    let changed=false;
    if(this.hintCancel&&now-this.hintCancel.started>=160){this.hintCancel=null;changed=true;}
    if(this.resetPresentationAt!==null&&now-this.resetPresentationAt>=560){this.resetPresentationAt=null;changed=true;}
    if(this.resetDipAt!==null&&now-this.resetDipAt>=260+30*(this.board.length-1)){this.resetDipAt=null;changed=true;}
    if(this.undoShimmer&&now-this.undoShimmer.started>=400){this.undoShimmer=null;changed=true;}
    for(let i=0;i<this.activeFlights.length;){
      const active=this.activeFlights[i];
      if(clamp01((now-active.started)/(active.kind==='undo'?UNDO_MS:POUR_MS))<1){i++;continue;}
      const source=this.surfaceAt(active.source,now,this.surfaceStates[active.source]);
      const target=this.surfaceAt(active.target,now,this.surfaceStates[active.target]);
      this.activeFlights.splice(i,1);
      this.transitionCaps(active.before,this.board,now,true,[active.source,active.target]);
      if(active.kind==='undo')this.record('undo-complete');
      else{
        this.settlingPairs.push({source:active.source,target:active.target,started:now,surfaces:this.surfaceStates.map((state,i)=>({... (i===active.source?source:i===active.target?target:state)}))});
        this.record('pour-complete','settle-start');
      }
      changed=true;
    }
    const invalid=this.invalidMotion;if(invalid&&clamp01((now-invalid.started)/INVALID_MS)>=1){this.invalidMotion=null;this.invalidSource=this.invalidTarget=null;this.record('invalid-complete');changed=true;}
    const pulse=this.selectionPulse;if(pulse&&clamp01((now-pulse.started)/this.selectionMs)>=1){this.selectionPulse=null;this.record('selection-complete');changed=true;}
    for(let i=0;i<this.settlingPairs.length;){const settle=this.settlingPairs[i];if(now-settle.started>=SETTLE_MS){this.settlingPairs.splice(i,1);this.record('settle-complete');changed=true;}else i++;}
    const hint=this.hintMotion;if(hint&&clamp01((now-hint.started)/this.hintMs)>=1){this.hintMotion=null;this.record('hint-complete');changed=true;}
    for(let i=0;i<this.poseCorrections.length;i++){const correction=this.poseCorrections[i];if(correction&&now-correction.started>=correction.duration){this.poseCorrections[i]=null;changed=true;}}
    for(let i=0;i<this.surfaceCorrections.length;i++){const correction=this.surfaceCorrections[i];if(correction&&now-correction.started>=correction.duration){this.surfaceCorrections[i]=null;changed=true;}}
    for(let i=0;i<this.capMotions.length;i++){const motion=this.capMotions[i];if(motion&&now-motion.started>=(motion.kind==='enter'?CAP_ENTER_MS:CAP_EXIT_MS)){this.capMotions[i]=null;changed=true;}}
    for(let i=0;i<this.completionMotions.length;i++){
      const motion=this.completionMotions[i];if(!motion)continue;
      if(!motion.recorded&&now>=motion.impactAt){motion.recorded=true;this.record(`cap-contact:${i}`);changed=true;}
      if(now-motion.impactAt>=COMPLETION_FX_MS){this.completionMotions[i]=null;changed=true;}
    }
    return changed;
  }
  isAnimating(){return!!(this.resetPresentationAt!==null||this.resetDipAt!==null||this.undoShimmer||this.flight||this.invalidMotion||this.selectionPulse||this.settleMotion||this.hintMotion||this.hintCancel||this.poseCorrections.some(Boolean)||this.surfaceCorrections.some(Boolean)||this.capMotions.some(Boolean)||this.completionMotions.some(Boolean));}
}
