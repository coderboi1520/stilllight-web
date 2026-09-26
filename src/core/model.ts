import { DEPARTURE_BLEND_MS,DESELECT_RETURN_MS,EPSILON,HINT_ATTENTION_MS,INITIAL,INVALID_MS,POUR_MS,SELECT_MS,SETTLE_MS,STREAM_END,STREAM_START,TRANSFER_END,TRANSFER_START,SURFACE_SAMPLES } from './constants.ts';
import { clamp01,invalidPose,movingPose,position,pourDirection,pouringLip,selectedPose,selectedPoseDerivative,smooth,streamControl,type Pose } from './geometry.ts';
import { liquidLevel,liquidTop,sampleSurface } from './liquidMath.ts';
import {clone,pour} from './rules.ts';
import type {GlassFrame,LiquidLayerFrame,RenderFrame,StreamFrame} from './RenderFrame.ts';

type Flight={source:number;target:number;before:number[][];amount:number;color:number;started:number};
type Invalid={source:number;target:number;direction:number;started:number};
type Pulse={index:number;started:number};
type Settle={source:number;target:number;direction:number;started:number};
type Hint={source:number;target:number;started:number};
type PoseCorrection={started:number;duration:number;dx:number;dy:number;da:number;dvx:number;dvy:number;dva:number};
type EventKinematics={pose:Pose;velocity:Pose};

const damped=(phase:number,decay:number)=>Math.sin(phase)*Math.exp(-decay);
const transferAt=(p:number)=>smooth((p-TRANSFER_START)/(TRANSFER_END-TRANSFER_START));
const sourceSlosh=(p:number,d:number)=>-d*.052*Math.sin(Math.PI*clamp01(p/.29))+d*.012*Math.sin((p-.24)*Math.PI*8)*Math.sin(Math.PI*clamp01((p-.20)/.54))+d*.048*Math.sin(Math.PI*clamp01((p-.69)/.31));
function receiverSlosh(p:number,d:number){if(p<=TRANSFER_START||p>=TRANSFER_END+.06)return 0;const q=clamp01((p-TRANSFER_START)/(TRANSFER_END-TRANSFER_START));return d*.020*Math.sin(q*Math.PI*5.2)*Math.sin(q*Math.PI);}
function zeroPose(out:Pose){out.x=0;out.y=0;out.angle=0;return out;}
function invalidStartVelocity(direction:number,out:Pose){const k=Math.PI*5.4;out.x=direction*8.5*k/INVALID_MS;out.y=1.2*Math.PI*2/INVALID_MS;out.angle=direction*.075*k/INVALID_MS;return out;}
function correctionValue(offset:number,velocity:number,elapsed:number,duration:number){const u=clamp01(elapsed/duration),u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*offset+(u3-2*u2+u)*duration*velocity;}
function correctionVelocity(offset:number,velocity:number,elapsed:number,duration:number){const u=clamp01(elapsed/duration),u2=u*u;return(6*u2-6*u)/duration*offset+(3*u2-4*u+1)*velocity;}

const makeLayer=():LiquidLayerFrame=>({color:0,amount:0,bottom:0,top:0,isTop:false,wavy:false,surface:new Float64Array(SURFACE_SAMPLES*2)});
const makeGlassFrame=(index:number):GlassFrame=>({index,pose:{x:0,y:0,angle:0},surfaceAngle:0,relativeLiquidRotation:0,wave:0,phase:0,dynamicLiquid:false,layers:[],selected:false,hintRole:null,invalid:false,moving:false});
const makeStreamFrame=():StreamFrame=>({visible:true,color:0,alpha:0,start:{x:0,y:0},control:{x:0,y:0},end:{x:0,y:0},impact:0});
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
  private streamFrame=makeStreamFrame();
  private frame:RenderFrame={now:0,board:this.boardFrame,glasses:this.glassFrames,stream:null,events:this.events,metrics:{pourProgress:0,transfer:0,settleProgress:0}};
  private poseCorrections:[PoseCorrection|null,PoseCorrection|null]=[null,null];
  private eventKinematics:[EventKinematics,EventKinematics]=[makeEventKinematics(),makeEventKinematics()];
  private targetPose:Pose={x:0,y:0,angle:0};
  private targetVelocity:Pose={x:0,y:0,angle:0};

  private record(...items:string[]){const next=[...this.events,...items];this.events=next.length>32?next.slice(-32):next;}

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
    const progress=active?clamp01((now-active.started)/POUR_MS):0,transfer=active?transferAt(progress):0,invalidProgress=invalid?clamp01((now-invalid.started)/INVALID_MS):0,pulseProgress=pulse?clamp01((now-pulse.started)/SELECT_MS):0,hintProgress=hint?clamp01((now-hint.started)/HINT_ATTENTION_MS):1;
    const moving=active?.source===index;
    position(index,out);out.angle=0;
    if(moving&&active){const remainingUnits=active.before[active.source].length-active.amount*transfer;movingPose(active.source,active.target,progress,remainingUnits,out);}
    else if(invalid&&index===invalid.source)invalidPose(index,invalidProgress,invalid.direction,out);
    else if(this.selected===index)selectedPose(index,pulse?.index===index?pulseProgress:1,out);
    if(!moving&&!invalid&&hint&&(hint.source===index||hint.target===index)&&hintProgress<1){const lift=Math.sin(Math.PI*hintProgress),hintPhase=hintProgress*Math.PI*4,hintDirection=hint.source===index?-1:1;out.y-=7*lift;out.x+=hintDirection*1.6*Math.sin(hintPhase)*lift;}
    if(includeCorrection)this.applyCorrection(index,now,out);
    return out;
  }

  private velocityAt(index:number,now:number,out:Pose,includeCorrection=true){
    zeroPose(out);
    const active=this.flight,invalid=this.invalidMotion,pulse=this.selectionPulse,hint=this.hintMotion,moving=active?.source===index;
    if(!active&&!invalid&&this.selected===index&&pulse?.index===index){const raw=(now-pulse.started)/SELECT_MS;if(raw>=0&&raw<1){selectedPoseDerivative(raw,out);out.y/=SELECT_MS;}}
    if(!moving&&!invalid&&hint&&(hint.source===index||hint.target===index)){const raw=(now-hint.started)/HINT_ATTENTION_MS;if(raw>=0&&raw<1){const q=raw,a=Math.PI*q,b=4*Math.PI*q,d=hint.source===index?-1:1;out.x+=d*1.6*(4*Math.PI*Math.cos(b)*Math.sin(a)+Math.PI*Math.cos(a)*Math.sin(b))/HINT_ATTENTION_MS;out.y+=-7*Math.PI*Math.cos(a)/HINT_ATTENTION_MS;}}
    if(includeCorrection)this.applyCorrectionVelocity(index,now,out);
    return out;
  }

  private capturePresented(index:number,now:number){const capture=this.eventKinematics[index];this.poseAt(index,now,capture.pose,true);this.velocityAt(index,now,capture.velocity,true);}

  private beginCorrection(index:number,now:number,duration:number,targetVelocity:Pose){
    const capture=this.eventKinematics[index];this.poseAt(index,now,this.targetPose,false);
    const dx=capture.pose.x-this.targetPose.x,dy=capture.pose.y-this.targetPose.y,da=capture.pose.angle-this.targetPose.angle,dvx=capture.velocity.x-targetVelocity.x,dvy=capture.velocity.y-targetVelocity.y,dva=capture.velocity.angle-targetVelocity.angle;
    if(Math.abs(dx)+Math.abs(dy)+Math.abs(da)+duration*(Math.abs(dvx)+Math.abs(dvy)+Math.abs(dva))<1e-9){this.poseCorrections[index]=null;return;}
    this.poseCorrections[index]={started:now,duration,dx,dy,da,dvx,dvy,dva};
  }

  reset(){this.board=clone(INITIAL);this.boardFrame=clone(this.board);this.selected=null;this.busy=false;this.flight=this.invalidMotion=this.selectionPulse=this.settleMotion=this.hintMotion=null;this.invalidSource=this.invalidTarget=null;this.poseCorrections[0]=this.poseCorrections[1]=null;this.events=['reset'];}

  choose(index:number,now:number){
    if(this.flight||this.invalidMotion||this.busy)return;
    const source=this.selected;
    if(source===null){
      if(this.board[index].length){this.capturePresented(index,now);this.settleMotion=null;this.selected=index;this.selectionPulse={index,started:now};this.hintMotion=null;this.velocityAt(index,now,this.targetVelocity,false);this.beginCorrection(index,now,SELECT_MS,this.targetVelocity);this.record(`selected:${index}`);}
      return;
    }
    if(source===index){this.capturePresented(source,now);this.selected=null;this.selectionPulse=null;this.velocityAt(source,now,this.targetVelocity,false);this.beginCorrection(source,now,DESELECT_RETURN_MS,this.targetVelocity);this.record('selection-cleared');return;}
    const result=pour(this.board,source,index);
    if(!result){const direction=position(index).x>=position(source).x?1:-1;this.capturePresented(source,now);this.selected=null;this.selectionPulse=null;this.settleMotion=null;this.invalidSource=source;this.invalidTarget=index;this.invalidMotion={source,target:index,direction,started:now};this.busy=true;invalidStartVelocity(direction,this.targetVelocity);this.beginCorrection(source,now,INVALID_MS,this.targetVelocity);this.record(`invalid:${source}->${index}`);return;}
    this.capturePresented(source,now);
    const before=clone(this.board);this.selected=null;this.selectionPulse=null;this.settleMotion=null;this.invalidSource=this.invalidTarget=null;this.flight={source,target:index,before,amount:result.amount,color:result.color,started:now};this.board=result.board;this.boardFrame=clone(this.board);this.busy=true;zeroPose(this.targetVelocity);this.beginCorrection(source,now,DEPARTURE_BLEND_MS,this.targetVelocity);this.record(`pour-start:${source}->${index}`);
  }

  hint(now:number){if(this.busy)return;this.hintMotion={source:0,target:1,started:now};this.record('hint-start');}

  invalid(now:number){
    if(this.busy)return;
    const selected=this.selected;
    this.capturePresented(0,now);if(selected!==null&&selected!==0)this.capturePresented(selected,now);
    this.selected=null;this.selectionPulse=null;this.invalidSource=0;this.invalidTarget=1;this.invalidMotion={source:0,target:1,direction:1,started:now};this.busy=true;
    invalidStartVelocity(1,this.targetVelocity);this.beginCorrection(0,now,INVALID_MS,this.targetVelocity);
    if(selected!==null&&selected!==0){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    this.record('invalid:0->1');
  }

  startPour(now:number){
    if(this.busy)return false;const result=pour(this.board,0,1);if(!result)return false;
    const selected=this.selected;this.capturePresented(0,now);if(selected!==null&&selected!==0)this.capturePresented(selected,now);
    const before=clone(this.board);this.flight={source:0,target:1,before,amount:result.amount,color:result.color,started:now};this.board=result.board;this.boardFrame=clone(this.board);this.selected=null;this.busy=true;this.settleMotion=null;
    zeroPose(this.targetVelocity);this.beginCorrection(0,now,DEPARTURE_BLEND_MS,this.targetVelocity);
    if(selected!==null&&selected!==0){this.velocityAt(selected,now,this.targetVelocity,false);this.beginCorrection(selected,now,DESELECT_RETURN_MS,this.targetVelocity);}
    this.record('pour-start:0->1');return true;
  }

  sample(now:number):RenderFrame{
    const active=this.flight,invalid=this.invalidMotion,pulse=this.selectionPulse,settling=this.settleMotion,hint=this.hintMotion;
    const progress=active?clamp01((now-active.started)/POUR_MS):0,transfer=active?transferAt(progress):0,invalidProgress=invalid?clamp01((now-invalid.started)/INVALID_MS):0,pulseProgress=pulse?clamp01((now-pulse.started)/SELECT_MS):0,settleProgress=settling?clamp01((now-settling.started)/SETTLE_MS):0,hintProgress=hint?clamp01((now-hint.started)/HINT_ATTENTION_MS):1,activeDirection=active?pourDirection(active.source,active.target):1;

    const makeGlass=(index:number,moving=false)=>{
      const frame=this.glassFrames[index];
      let surfaceAngle=0,wave=0,phase=now*.018,dynamicLiquid=false;
      this.poseAt(index,now,frame.pose,true);

      if(moving&&active){surfaceAngle=sourceSlosh(progress,activeDirection);wave=.7+1.7*Math.abs(Math.sin(progress*Math.PI*4.2))*Math.sin(Math.PI*clamp01(progress/.92));dynamicLiquid=true;}
      else if(invalid&&index===invalid.source){const env=Math.pow(1-invalidProgress,1.15);surfaceAngle=-invalid.direction*.065*Math.sin((invalidProgress-.065)*Math.PI*5.4)*env;wave=2.4*Math.abs(Math.sin(invalidProgress*Math.PI*4.8))*env;phase+=invalidProgress*4;dynamicLiquid=true;}
      else if(this.selected===index){if(pulse?.index===index&&pulseProgress<1){surfaceAngle=.018*damped(pulseProgress*Math.PI*4.5,pulseProgress*2.4);wave=1.65*Math.sin(Math.PI*pulseProgress)*Math.exp(-pulseProgress*.8);dynamicLiquid=true;}}

      if(active&&index===active.target&&progress>TRANSFER_START&&progress<.82){surfaceAngle+=receiverSlosh(progress,activeDirection);const flowEnvelope=Math.sin(Math.PI*clamp01((progress-TRANSFER_START)/(.82-TRANSFER_START)));wave=Math.max(wave,.35+1.9*Math.max(0,flowEnvelope));phase-=transfer*5;dynamicLiquid=true;}
      if(!active&&settling&&(index===settling.source||index===settling.target)){const env=Math.exp(-settleProgress*3.2),sign=index===settling.target?-1:1;surfaceAngle+=sign*settling.direction*.036*Math.sin(settleProgress*Math.PI*5.5)*env;wave=Math.max(wave,(index===settling.target?2:1.2)*Math.abs(Math.sin(settleProgress*Math.PI*4.4))*env);phase+=settleProgress*5;dynamicLiquid=true;}

      const sourceLayers=(active?active.before:this.board)[index];
      const slots=this.layerSlots[index];
      let layerCount=sourceLayers.length;
      for(let i=0;i<layerCount;i++){const slot=slots[i];slot.color=sourceLayers[i];slot.amount=1;}
      if(active&&index===active.source){let remaining=active.amount*transfer;for(let i=layerCount-1;i>=0&&remaining>EPSILON;i--){const slot=slots[i],taken=Math.min(remaining,slot.amount);slot.amount-=taken;remaining-=taken;}}
      if(active&&index===active.target){const slot=slots[layerCount++];slot.color=active.color;slot.amount=active.amount*transfer;}

      const relative=frame.pose.angle-surfaceAngle,movingLiquid=dynamicLiquid||Math.abs(frame.pose.angle)>.002;
      let total=0,boundary=movingLiquid?liquidLevel(0,relative):158,visibleCount=0;
      for(let i=0;i<layerCount;i++){
        const layer=slots[i];if(layer.amount<=EPSILON)continue;
        const bottom=boundary;total+=layer.amount;const top=movingLiquid?liquidLevel(total,relative):liquidTop(total);boundary=top;
        const out=slots[visibleCount];
        if(out!==layer){out.color=layer.color;out.amount=layer.amount;}
        out.bottom=bottom;out.top=top;out.isTop=false;out.wavy=false;
        visibleCount++;
      }
      if(visibleCount){const topLayer=slots[visibleCount-1];topLayer.isTop=true;topLayer.wavy=wave>.05;if(topLayer.wavy)sampleSurface(topLayer.top,wave,phase,topLayer.surface!);}
      frame.layers.length=visibleCount;
      for(let i=0;i<visibleCount;i++)frame.layers[i]=slots[i];
      frame.surfaceAngle=surfaceAngle;frame.relativeLiquidRotation=-frame.pose.angle+surfaceAngle;frame.wave=wave;frame.phase=phase;frame.dynamicLiquid=movingLiquid;frame.selected=this.selected===index;
      frame.hintRole=moving?null:hint?.source===index?'source':hint?.target===index?'target':null;
      frame.invalid=this.invalidSource===index||this.invalidTarget===index;frame.moving=moving;
      return frame;
    };

    const glasses=this.glassFrames;
    makeGlass(0,active?.source===0);makeGlass(1,active?.source===1);
    let stream:StreamFrame|null=null;
    if(active&&progress>STREAM_START&&progress<STREAM_END){
      const moving=glasses[active.source],direction=activeDirection,targetUnits=active.before[active.target].length+active.amount*transfer,q=clamp01((progress-STREAM_START)/(STREAM_END-STREAM_START));
      stream=this.streamFrame;pouringLip(moving.pose,direction,stream.start);position(active.target,stream.end);stream.end.y+=liquidTop(targetUnits)+1;streamControl(stream.start,stream.end,direction,stream.control);stream.visible=true;stream.color=active.color;stream.alpha=Math.max(0,Math.min(1,q*7,(1-q)*7));stream.impact=Math.sin(Math.PI*transfer);
    }
    const frame=this.frame;frame.now=now;frame.board=this.boardFrame;frame.stream=stream;frame.events=this.events;frame.metrics.pourProgress=progress;frame.metrics.transfer=transfer;frame.metrics.settleProgress=settleProgress;
    return frame;
  }

  advanceAfterFrame(now:number){
    let active=this.flight,changed=false;
    if(active&&clamp01((now-active.started)/POUR_MS)>=1){const direction=pourDirection(active.source,active.target);this.flight=null;this.busy=false;this.settleMotion={source:active.source,target:active.target,direction,started:now};this.record('pour-complete','settle-start');changed=true;}
    const invalid=this.invalidMotion;if(invalid&&clamp01((now-invalid.started)/INVALID_MS)>=1){this.invalidMotion=null;this.invalidSource=this.invalidTarget=null;this.busy=false;this.record('invalid-complete');changed=true;}
    const pulse=this.selectionPulse;if(pulse&&clamp01((now-pulse.started)/SELECT_MS)>=1){this.selectionPulse=null;this.record('selection-complete');changed=true;}
    const settle=this.settleMotion;if(!this.flight&&settle&&clamp01((now-settle.started)/SETTLE_MS)>=1){this.settleMotion=null;this.record('settle-complete');changed=true;}
    const hint=this.hintMotion;if(hint&&clamp01((now-hint.started)/HINT_ATTENTION_MS)>=1){this.hintMotion=null;this.record('hint-complete');changed=true;}
    for(let i=0;i<this.poseCorrections.length;i++){const correction=this.poseCorrections[i];if(correction&&now-correction.started>=correction.duration){this.poseCorrections[i]=null;changed=true;}}
    return changed;
  }
  isAnimating(){return!!(this.flight||this.invalidMotion||this.selectionPulse||this.settleMotion||this.hintMotion||this.poseCorrections[0]||this.poseCorrections[1]);}
}
