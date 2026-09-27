import { DEPARTURE_BLEND_MS,DESELECT_RETURN_MS,EPSILON,HINT_ATTENTION_MS,INITIAL,INVALID_MS,POUR_MS,UNDO_MS,SELECT_MS,SETTLE_MS,STREAM_END,STREAM_START,TRANSFER_END,TRANSFER_START,SURFACE_SAMPLES } from './constants.ts';
import { clamp01,invalidFeedbackPose,movingPose,position,pourDirection,pouringLip,selectedPose,selectedPoseDerivative,smooth,smoother,streamControl,type Pose } from './geometry.ts';
import { liquidLevel,liquidTop,sampleSurface } from './liquidMath.ts';
import {prepareSurfaceContact} from './contact.ts';
import {clone,isBottleComplete,pour} from './rules.ts';
import {CAP_ENTER_MS,CAP_EXIT_MS,sampleCap,type CapMotion} from './capMotion.ts';
import type {GlassFrame,LiquidLayerFrame,ReceiverResponseFrame,RenderFrame,StreamFrame} from './RenderFrame.ts';

type Flight={source:number;target:number;before:number[][];amount:number;color:number;started:number;kind:'pour'|'undo'};
type MoveHistory={source:number;target:number;color:number;amount:number;beforeSource:readonly number[];beforeTarget:readonly number[];afterSource:readonly number[];afterTarget:readonly number[]};
type Invalid={source:number;target:number;direction:number;started:number};
type Pulse={index:number;started:number};
type SurfaceState={angle:number;wave:number;phase:number};
type SurfaceCorrection={started:number;duration:number;angle:number;wave:number;phase:number;dAngle:number;dWave:number;dPhase:number};
type Settle={source:number;target:number;started:number;surfaces:[SurfaceState,SurfaceState]};
type Hint={source:number;target:number;started:number};
type PoseCorrection={started:number;duration:number;dx:number;dy:number;da:number;dvx:number;dvy:number;dva:number};
type EventKinematics={pose:Pose;velocity:Pose};

const damped=(phase:number,decay:number)=>Math.sin(phase)*Math.exp(-decay);
const transferAt=(p:number)=>smooth((p-TRANSFER_START)/(TRANSFER_END-TRANSFER_START));
const HINT_TARGET_DELAY_MS=80,HINT_FADE_IN_MS=70,HINT_FADE_OUT_MS=120;
const SURFACE_DERIVATIVE_STEP=.05;
const UNDO_HISTORY_LIMIT=64;
const RESPONSE_TAPER_START=.55;
const RESPONSE_TAPER_Q=(RESPONSE_TAPER_START-TRANSFER_START)/(TRANSFER_END-TRANSFER_START);
const RESPONSE_TAPER_VALUE=4*RESPONSE_TAPER_Q*(1-RESPONSE_TAPER_Q);
const RESPONSE_TAPER_VELOCITY=4*(1-2*RESPONSE_TAPER_Q)/(TRANSFER_END-TRANSFER_START);
function hintStrength(hint:Hint|null,index:number,now:number){
  if(!hint||index!==hint.source&&index!==hint.target)return 0;
  const elapsed=now-hint.started-(index===hint.target?HINT_TARGET_DELAY_MS:0);
  return smooth(elapsed/HINT_FADE_IN_MS)*(1-smooth((now-hint.started-(HINT_ATTENTION_MS-HINT_FADE_OUT_MS))/HINT_FADE_OUT_MS));
}
function hintStrengthVelocity(hint:Hint|null,index:number,now:number){
  if(!hint||index!==hint.source&&index!==hint.target)return 0;
  const elapsed=now-hint.started-(index===hint.target?HINT_TARGET_DELAY_MS:0),fade=now-hint.started-(HINT_ATTENTION_MS-HINT_FADE_OUT_MS);
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
function flightSurface(active:Flight,index:number,now:number,out:SurfaceState){
  const p=clamp01((now-active.started)/POUR_MS),direction=pourDirection(active.source,active.target);
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
  const p=clamp01((now-active.started)/UNDO_MS);
  const response=smoother(p/.22)*(1-.85*smoother((p-.62)/.38));
  const refilling=index===active.target;
  out.angle=(refilling?.014:-.010)*response;
  out.wave=(refilling?1.5:1.1)*response;
  out.phase=now*.018+(refilling?-1.1:.85)*smoother(p/.22);
  return out;
}
function zeroPose(out:Pose){out.x=0;out.y=0;out.angle=0;return out;}
function correctionValue(offset:number,velocity:number,elapsed:number,duration:number){const u=clamp01(elapsed/duration),u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*offset+(u3-2*u2+u)*duration*velocity;}
function correctionVelocity(offset:number,velocity:number,elapsed:number,duration:number){const u=clamp01(elapsed/duration),u2=u*u;return(6*u2-6*u)/duration*offset+(3*u2-4*u+1)*velocity;}

const makeLayer=():LiquidLayerFrame=>({color:0,amount:0,bottom:0,top:0,isTop:false,wavy:false,surface:new Float64Array(SURFACE_SAMPLES*2)});
const makeGlassFrame=(index:number):GlassFrame=>({index,pose:{x:0,y:0,angle:0},surfaceAngle:0,relativeLiquidRotation:0,wave:0,phase:0,dynamicLiquid:false,layers:[],contact:{local:{x:0,y:0},world:{x:0,y:0},tangent:{x:1,y:0},empty:true},response:null,cap:{visible:false,alpha:1,y:1,scaleX:1,scaleY:1,rotation:0},selected:false,hintRole:null,hintStrength:0,invalid:false,invalidStrength:0,moving:false});
const makeSurfaceState=():SurfaceState=>({angle:0,wave:0,phase:0});
const makeStreamFrame=():StreamFrame=>({visible:true,color:0,alpha:0,reveal:0,widthScale:1,start:{x:0,y:0},control:{x:0,y:0},end:{x:0,y:0}});
const makeEventKinematics=():EventKinematics=>({pose:{x:0,y:0,angle:0},velocity:{x:0,y:0,angle:0}});

export class StilllightModel{
  board=clone(INITIAL);
  private boardFrame=clone(INITIAL);
  selected:number|null=null;
  busy=false;
  flight:Flight|null=null;
  invalidMotion:Invalid|null=null;
  selectionPulse:Pulse|null=null;
  settleMotion:Settle|null=null;
  hintMotion:Hint|null=null;
  invalidSource:number|null=null;
  invalidTarget:number|null=null;
  events:readonly string[]=[];

  private layerSlots=[[makeLayer(),makeLayer(),makeLayer(),makeLayer(),makeLayer()],[makeLayer(),makeLayer(),makeLayer(),makeLayer(),makeLayer()]];
  private glassFrames:[GlassFrame,GlassFrame]=[makeGlassFrame(0),makeGlassFrame(1)];
  private receiverResponse:ReceiverResponseFrame={contact:this.glassFrames[1].contact,intensity:0,spread:0};
  private streamFrame=makeStreamFrame();
  private frame:RenderFrame={now:0,board:this.boardFrame,glasses:this.glassFrames,stream:null,events:this.events,metrics:{pourProgress:0,transfer:0,settleProgress:0}};
  private poseCorrections:[PoseCorrection|null,PoseCorrection|null]=[null,null];
  private surfaceCorrections:[SurfaceCorrection|null,SurfaceCorrection|null]=[null,null];
  private surfaceStates:[SurfaceState,SurfaceState]=[makeSurfaceState(),makeSurfaceState()];
  private surfaceCaptures:[SurfaceState,SurfaceState]=[makeSurfaceState(),makeSurfaceState()];
  private surfaceVelocities:[SurfaceState,SurfaceState]=[makeSurfaceState(),makeSurfaceState()];
  private surfaceBefore=makeSurfaceState();
  private surfaceTarget=makeSurfaceState();
  private surfaceTargetAfter=makeSurfaceState();
  private eventKinematics:[EventKinematics,EventKinematics]=[makeEventKinematics(),makeEventKinematics()];
  private targetPose:Pose={x:0,y:0,angle:0};
  private targetVelocity:Pose={x:0,y:0,angle:0};
  private moveHistory:MoveHistory[]=[];
  private capComplete:[boolean,boolean]=[isBottleComplete(INITIAL[0]),isBottleComplete(INITIAL[1])];
  private capMotions:[CapMotion|null,CapMotion|null]=[null,null];

  get undoDepth(){return this.moveHistory.length;}

  private transitionCaps(before:readonly (readonly number[])[],after:readonly (readonly number[])[],now:number,entry:boolean){
    for(let index=0;index<2;index++){
      const was=isBottleComplete(before[index]),next=isBottleComplete(after[index]);
      if(entry){if(!was&&next){this.capComplete[index]=true;this.capMotions[index]={kind:'enter',started:now};}}
      else if(was&&!next){const from=sampleCap(this.capComplete[index],this.capMotions[index],now,{visible:false,alpha:1,y:1,scaleX:1,scaleY:1,rotation:0});this.capComplete[index]=false;this.capMotions[index]={kind:'exit',started:now,from};}
    }
  }

  private record(...items:string[]){const next=[...this.events,...items];this.events=next.length>32?next.slice(-32):next;}

  private rememberMove(source:number,target:number,color:number,amount:number,before:number[][],after:number[][]){
    const entry:MoveHistory=Object.freeze({source,target,color,amount,
      beforeSource:Object.freeze([...before[source]]),beforeTarget:Object.freeze([...before[target]]),
      afterSource:Object.freeze([...after[source]]),afterTarget:Object.freeze([...after[target]])});
    if(this.moveHistory.length===UNDO_HISTORY_LIMIT)this.moveHistory.shift();
    this.moveHistory.push(entry);
  }

  private capturePair(now:number){this.capturePresented(0,now);this.capturePresented(1,now);}

  private continueClearedPartner(index:number,now:number,hint:Hint|null,settle:Settle|null){
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
    const active=this.flight,invalid=this.invalidMotion,pulse=this.selectionPulse,hint=this.hintMotion;
    const progress=active?clamp01((now-active.started)/POUR_MS):0,transfer=active?transferAt(progress):0,invalidProgress=invalid?clamp01((now-invalid.started)/INVALID_MS):0,pulseProgress=pulse?clamp01((now-pulse.started)/SELECT_MS):0;
    const moving=active?.kind==='pour'&&active.source===index;
    position(index,out);out.angle=0;
    if(moving&&active){const remainingUnits=active.before[active.source].length-active.amount*transfer;movingPose(active.source,active.target,progress,remainingUnits,out);}
    else if(invalid&&index===invalid.source)invalidFeedbackPose(index,invalidProgress,invalid.direction,out);
    else if(this.selected===index)selectedPose(index,pulse?.index===index?pulseProgress:1,out);
    if(!moving&&!invalid&&hint)out.y-=(hint.source===index?1.8:hint.target===index?1.2:0)*hintStrength(hint,index,now);
    if(includeCorrection)this.applyCorrection(index,now,out);
    return out;
  }

  private velocityAt(index:number,now:number,out:Pose,includeCorrection=true){
    zeroPose(out);
    const active=this.flight,invalid=this.invalidMotion,pulse=this.selectionPulse,hint=this.hintMotion,moving=active?.kind==='pour'&&active.source===index;
    if(!active&&!invalid&&this.selected===index&&pulse?.index===index){const raw=(now-pulse.started)/SELECT_MS;if(raw>=0&&raw<1){selectedPoseDerivative(raw,out);out.y/=SELECT_MS;}}
    if(!moving&&!invalid&&hint)out.y-=(hint.source===index?1.8:hint.target===index?1.2:0)*hintStrengthVelocity(hint,index,now);
    if(includeCorrection)this.applyCorrectionVelocity(index,now,out);
    return out;
  }

  private surfaceAt(index:number,now:number,out:SurfaceState,includeCorrection=true){
    const active=this.flight,invalid=this.invalidMotion,pulse=this.selectionPulse,settle=this.settleMotion;
    out.angle=0;out.wave=0;out.phase=now*.018;
    if(active?.kind==='pour')flightSurface(active,index,now,out);
    else if(active?.kind==='undo')undoSurface(active,index,now,out);
    else if(invalid&&index===invalid.source){const p=clamp01((now-invalid.started)/INVALID_MS),envelope=Math.sin(Math.PI*p);out.angle=-invalid.direction*.026*envelope*envelope;out.wave=1.15*envelope*envelope;}
    else if(this.selected===index&&pulse?.index===index){const p=clamp01((now-pulse.started)/SELECT_MS);if(p<1){out.angle=.018*damped(p*Math.PI*4.5,p*2.4);out.wave=1.65*Math.sin(Math.PI*p)*Math.exp(-p*.8);}}
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
    out.wave=Math.max(0,out.wave);
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

  reset(){this.board=clone(INITIAL);this.boardFrame=clone(this.board);this.selected=null;this.busy=false;this.flight=this.invalidMotion=this.selectionPulse=this.settleMotion=this.hintMotion=null;this.invalidSource=this.invalidTarget=null;this.poseCorrections[0]=this.poseCorrections[1]=null;this.surfaceCorrections[0]=this.surfaceCorrections[1]=null;this.capComplete=[isBottleComplete(this.board[0]),isBottleComplete(this.board[1])];this.capMotions=[null,null];this.moveHistory.length=0;this.events=['reset'];}

  previewCompletedRight(now:number){
    this.reset();
    const before=this.board;
    this.board=clone(before);this.board[1]=[3,3,3,3];this.boardFrame=clone(this.board);
    this.transitionCaps(before,this.board,now,true);
  }

  choose(index:number,now:number){
    if(this.flight||this.invalidMotion||this.busy)return;
    const source=this.selected;
    if(source===null){
      if(this.board[index].length){
        const hint=this.hintMotion,settle=this.settleMotion;
        this.capturePair(now);
        this.settleMotion=null;this.selected=index;this.selectionPulse={index,started:now};this.hintMotion=null;
        this.velocityAt(index,now,this.targetVelocity,false);this.beginCorrection(index,now,SELECT_MS,this.targetVelocity);
        this.continueClearedPartner(1-index,now,hint,settle);
        this.record(`selected:${index}`);
      }
      return;
    }
    if(source===index){this.capturePresented(source,now);this.selected=null;this.selectionPulse=null;this.velocityAt(source,now,this.targetVelocity,false);this.beginCorrection(source,now,DESELECT_RETURN_MS,this.targetVelocity);this.record('selection-cleared');return;}
    const result=pour(this.board,source,index);
    if(!result){
      const direction=position(index).x>=position(source).x?1:-1,hint=this.hintMotion,settle=this.settleMotion;
      this.capturePair(now);
      this.selected=null;this.selectionPulse=null;this.settleMotion=null;this.hintMotion=null;
      this.invalidSource=source;this.invalidTarget=index;this.invalidMotion={source,target:index,direction,started:now};this.busy=true;
      zeroPose(this.targetVelocity);this.beginCorrection(source,now,INVALID_MS,this.targetVelocity);
      this.continueClearedPartner(index,now,hint,settle);
      this.record(`invalid:${source}->${index}`);return;
    }
    const settle=this.settleMotion;
    this.capturePair(now);
    const before=clone(this.board);
    this.selected=null;this.selectionPulse=null;this.settleMotion=null;this.invalidSource=this.invalidTarget=null;
    this.flight={source,target:index,before,amount:result.amount,color:result.color,started:now,kind:'pour'};
    this.board=result.board;this.boardFrame=clone(this.board);this.busy=true;this.transitionCaps(before,this.board,now,false);
    this.rememberMove(source,index,result.color,result.amount,before,this.board);
    zeroPose(this.targetVelocity);this.beginCorrection(source,now,DEPARTURE_BLEND_MS,this.targetVelocity);
    if(settle)this.beginSurfaceCorrection(index,now,DEPARTURE_BLEND_MS);
    this.record(`pour-start:${source}->${index}`);
  }

  undo(now:number){
    if(this.busy||this.flight||this.invalidMotion)return false;
    const entry=this.moveHistory.at(-1);
    if(!entry||!this.historyMatches(entry))return false;
    this.capturePair(now);
    for(let index=0;index<2;index++){
      const home=position(index),{pose,velocity}=this.eventKinematics[index];
      if(Math.abs(pose.x-home.x)+Math.abs(pose.y-home.y)+Math.abs(pose.angle)+
        Math.abs(velocity.x)+Math.abs(velocity.y)+Math.abs(velocity.angle)>1e-7)return false;
    }
    const before=clone(this.board);
    const restored=clone(this.board);
    restored[entry.source]=[...entry.beforeSource];restored[entry.target]=[...entry.beforeTarget];
    this.moveHistory.pop();
    this.selected=null;this.selectionPulse=null;this.settleMotion=null;this.hintMotion=null;
    this.invalidSource=this.invalidTarget=null;
    this.flight={source:entry.target,target:entry.source,before,amount:entry.amount,color:entry.color,started:now,kind:'undo'};
    this.board=restored;this.boardFrame=clone(restored);this.busy=true;this.transitionCaps(before,restored,now,false);
    this.poseCorrections[0]=this.poseCorrections[1]=null;
    this.beginSurfaceCorrection(0,now,UNDO_MS);this.beginSurfaceCorrection(1,now,UNDO_MS);
    this.record(`undo-start:${entry.target}->${entry.source}`);
    return true;
  }

  hint(now:number){if(this.busy||this.hintMotion&&now-this.hintMotion.started<HINT_ATTENTION_MS)return;this.hintMotion={source:0,target:1,started:now};this.record('hint-start');}

  invalid(now:number){
    if(this.busy)return;
    const selected=this.selected,hint=this.hintMotion;
    this.capturePair(now);
    this.selected=null;this.selectionPulse=null;this.hintMotion=null;this.invalidSource=0;this.invalidTarget=1;this.invalidMotion={source:0,target:1,direction:1,started:now};this.busy=true;
    zeroPose(this.targetVelocity);this.beginCorrection(0,now,INVALID_MS,this.targetVelocity);
    if(selected!==null&&selected!==0){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    else this.continueClearedPartner(1,now,hint,null);
    this.record('invalid:0->1');
  }

  startPour(now:number){
    if(this.busy)return false;const result=pour(this.board,0,1);if(!result)return false;
    const selected=this.selected,settle=this.settleMotion;this.capturePair(now);
    const before=clone(this.board);this.flight={source:0,target:1,before,amount:result.amount,color:result.color,started:now,kind:'pour'};this.board=result.board;this.boardFrame=clone(this.board);this.selected=null;this.busy=true;this.settleMotion=null;this.transitionCaps(before,this.board,now,false);
    this.rememberMove(0,1,result.color,result.amount,before,this.board);
    zeroPose(this.targetVelocity);this.beginCorrection(0,now,DEPARTURE_BLEND_MS,this.targetVelocity);
    if(selected!==null&&selected!==0){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    else if(settle)this.beginSurfaceCorrection(1,now,DEPARTURE_BLEND_MS);
    this.record('pour-start:0->1');return true;
  }

  sample(now:number):RenderFrame{
    const active=this.flight,invalid=this.invalidMotion,settling=this.settleMotion,hint=this.hintMotion;
    const progress=active?clamp01((now-active.started)/(active.kind==='undo'?UNDO_MS:POUR_MS)):0,transfer=active?(active.kind==='undo'?smooth(progress):transferAt(progress)):0,invalidProgress=invalid?clamp01((now-invalid.started)/INVALID_MS):0,settleProgress=settling?clamp01((now-settling.started)/SETTLE_MS):0,activeDirection=active?pourDirection(active.source,active.target):1;

    const makeGlass=(index:number,moving=false)=>{
      const frame=this.glassFrames[index];
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
      if(visibleCount){const topLayer=slots[visibleCount-1];topLayer.isTop=true;topLayer.wavy=true;sampleSurface(topLayer.top,wave,phase,topLayer.surface!);}
      frame.layers.length=visibleCount;
      for(let i=0;i<visibleCount;i++)frame.layers[i]=slots[i];
      frame.surfaceAngle=surfaceAngle;frame.relativeLiquidRotation=-frame.pose.angle+surfaceAngle;frame.wave=wave;frame.phase=phase;frame.dynamicLiquid=movingLiquid;frame.selected=this.selected===index;
      frame.hintStrength=moving?0:hintStrength(hint,index,now);
      frame.hintRole=frame.hintStrength>0?hint?.source===index?'source':hint?.target===index?'target':null:null;
      frame.invalid=this.invalidSource===index||this.invalidTarget===index;
      frame.invalidStrength=frame.invalid?invalidStrength(invalidProgress):0;frame.moving=moving;
      sampleCap(this.capComplete[index],this.capMotions[index],now,frame.cap);
      return frame;
    };

    const glasses=this.glassFrames;
    makeGlass(0,active?.kind==='pour'&&active.source===0);makeGlass(1,active?.kind==='pour'&&active.source===1);
    prepareSurfaceContact(glasses[0],-1,glasses[0].contact);
    prepareSurfaceContact(glasses[1],1,glasses[1].contact);
    if(active?.kind==='pour'){
      const receiver=glasses[active.target];
      const impactX=progress>STREAM_START&&progress<STREAM_END?
        pouringLip(glasses[active.source].pose,activeDirection,this.streamFrame.start).x:receiver.pose.x;
      prepareSurfaceContact(receiver,activeDirection,receiver.contact,impactX);
    }
    glasses[0].response=glasses[1].response=null;
    let stream:StreamFrame|null=null;
    let responseIntensity=0;
    if(active?.kind==='pour'&&progress>STREAM_START&&progress<1){
      const receiver=glasses[active.target],contact=receiver.contact;
      responseIntensity=receiverResponseAt(progress);
      if(responseIntensity>0){
        const response=this.receiverResponse;response.contact=contact;response.intensity=responseIntensity;
        response.spread=7+12*smoother((progress-TRANSFER_START)/.50);
        receiver.response=response;
      }
    }
    if(active?.kind==='pour'&&progress>STREAM_START&&progress<STREAM_END){
      const moving=glasses[active.source],contact=glasses[active.target].contact,direction=activeDirection,q=clamp01((progress-STREAM_START)/(STREAM_END-STREAM_START));
      stream=this.streamFrame;pouringLip(moving.pose,direction,stream.start);
      stream.end.x=contact.world.x;stream.end.y=contact.world.y;
      streamControl(stream.start,stream.end,direction,stream.control);
      stream.visible=true;stream.color=active.color;stream.alpha=Math.max(0,Math.min(1,q*7,(1-q)*7));
      stream.reveal=smoother((progress-STREAM_START)/(TRANSFER_START-STREAM_START));
      stream.widthScale=1-.65*smoother((progress-TRANSFER_END)/(STREAM_END-TRANSFER_END));
    }
    const frame=this.frame;frame.now=now;frame.board=this.boardFrame;frame.stream=stream;frame.events=this.events;frame.metrics.pourProgress=progress;frame.metrics.transfer=transfer;frame.metrics.settleProgress=settleProgress;
    return frame;
  }

  advanceAfterFrame(now:number){
    let active=this.flight,changed=false;
    if(active&&clamp01((now-active.started)/(active.kind==='undo'?UNDO_MS:POUR_MS))>=1){
      const source=this.surfaceAt(active.source,now,this.surfaceStates[active.source]);
      const target=this.surfaceAt(active.target,now,this.surfaceStates[active.target]);
      this.flight=null;this.busy=false;
      this.transitionCaps(active.before,this.board,now,true);
      this.settleMotion={source:active.source,target:active.target,started:now,surfaces:[
        active.source===0?{...source}:{...target},active.source===1?{...source}:{...target}
      ]};
      this.record(active.kind==='pour'?'pour-complete':'undo-complete','settle-start');
      changed=true;
    }
    const invalid=this.invalidMotion;if(invalid&&clamp01((now-invalid.started)/INVALID_MS)>=1){this.invalidMotion=null;this.invalidSource=this.invalidTarget=null;this.busy=false;this.record('invalid-complete');changed=true;}
    const pulse=this.selectionPulse;if(pulse&&clamp01((now-pulse.started)/SELECT_MS)>=1){this.selectionPulse=null;this.record('selection-complete');changed=true;}
    const settle=this.settleMotion;if(!this.flight&&settle&&clamp01((now-settle.started)/SETTLE_MS)>=1){this.settleMotion=null;this.record('settle-complete');changed=true;}
    const hint=this.hintMotion;if(hint&&clamp01((now-hint.started)/HINT_ATTENTION_MS)>=1){this.hintMotion=null;this.record('hint-complete');changed=true;}
    for(let i=0;i<this.poseCorrections.length;i++){const correction=this.poseCorrections[i];if(correction&&now-correction.started>=correction.duration){this.poseCorrections[i]=null;changed=true;}}
    for(let i=0;i<this.surfaceCorrections.length;i++){const correction=this.surfaceCorrections[i];if(correction&&now-correction.started>=correction.duration){this.surfaceCorrections[i]=null;changed=true;}}
    for(let i=0;i<this.capMotions.length;i++){const motion=this.capMotions[i];if(motion&&now-motion.started>=(motion.kind==='enter'?CAP_ENTER_MS:CAP_EXIT_MS)){this.capMotions[i]=null;changed=true;}}
    return changed;
  }
  isAnimating(){return!!(this.flight||this.invalidMotion||this.selectionPulse||this.settleMotion||this.hintMotion||this.poseCorrections[0]||this.poseCorrections[1]||this.surfaceCorrections[0]||this.surfaceCorrections[1]||this.capMotions[0]||this.capMotions[1]);}
}
