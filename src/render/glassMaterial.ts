export function drawInteriorGlassPath(ctx:CanvasRenderingContext2D){
  ctx.beginPath();
  ctx.moveTo(-33,0);
  ctx.bezierCurveTo(-33,2.485,-18.225,4.5,0,4.5);
  ctx.bezierCurveTo(18.225,4.5,33,2.485,33,0);
  ctx.lineTo(33,130);
  ctx.quadraticCurveTo(33,154,12,156);
  ctx.lineTo(-12,156);
  ctx.quadraticCurveTo(-33,154,-33,130);
  ctx.closePath();
}

export function drawOpenWallPath(ctx:CanvasRenderingContext2D){
  ctx.beginPath();
  ctx.moveTo(-33,0);
  ctx.lineTo(-33,130);
  ctx.quadraticCurveTo(-33,154,-12,156);
  ctx.lineTo(12,156);
  ctx.quadraticCurveTo(33,154,33,130);
  ctx.lineTo(33,0);
}

export function drawRim(ctx:CanvasRenderingContext2D){
  ctx.beginPath();
  ctx.ellipse(0,0,33,4.5,0,0,Math.PI*2);
}

export function drawBodyShadow(ctx:CanvasRenderingContext2D){
  ctx.fillStyle='rgba(12,31,42,.78)';
  ctx.shadowColor='#000';
  ctx.shadowBlur=7;
  drawInteriorGlassPath(ctx);
  ctx.fill();
  ctx.globalCompositeOperation='destination-out';
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff';
  drawInteriorGlassPath(ctx);
  ctx.fill();
}

export function drawGlassRim(ctx:CanvasRenderingContext2D){
  ctx.lineCap='round';
  drawRim(ctx);
  ctx.strokeStyle='rgba(169,202,219,.28)';
  ctx.lineWidth=1.05;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0,0,33,4.5,0,0,Math.PI);
  ctx.strokeStyle='rgba(234,247,250,.78)';
  ctx.lineWidth=1.5;
  ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,0,33,4.5,0,.62,1.06);ctx.strokeStyle='rgba(241,250,255,.9)';ctx.stroke();
}

export function drawGlassBase(ctx:CanvasRenderingContext2D){
  const shade=ctx.createLinearGradient(0,118,0,158);
  shade.addColorStop(0,'rgba(4,16,22,0)');
  shade.addColorStop(.58,'rgba(4,16,22,.025)');
  shade.addColorStop(1,'rgba(4,16,22,.107)');
  ctx.fillStyle=shade;
  ctx.fillRect(0,118,68,40);

  ctx.save();
  ctx.translate(34,153);
  ctx.scale(1,.28);
  const lift=ctx.createRadialGradient(0,0,4,0,0,32);
  lift.addColorStop(0,'rgba(225,245,249,.045)');
  lift.addColorStop(.55,'rgba(225,245,249,.018)');
  lift.addColorStop(1,'rgba(225,245,249,0)');
  ctx.fillStyle=lift;
  ctx.fillRect(-34,-34,68,68);
  ctx.restore();
  const streak=ctx.createLinearGradient(0,16,0,124);streak.addColorStop(0,'rgba(255,255,255,0)');streak.addColorStop(.4,'rgba(255,255,255,.20)');streak.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=streak;ctx.fillRect(8,16,3,108);
}

export function drawGlassEdge(ctx:CanvasRenderingContext2D){
  const fade=ctx.createLinearGradient(0,23,0,111);
  fade.addColorStop(0,'rgba(242,251,255,0)');
  fade.addColorStop(.2,'rgba(242,251,255,.10)');
  fade.addColorStop(.5,'rgba(242,251,255,.22)');
  fade.addColorStop(.8,'rgba(242,251,255,.09)');
  fade.addColorStop(1,'rgba(242,251,255,0)');
  ctx.save();
  ctx.lineCap='round';
  ctx.strokeStyle=fade;
  ctx.lineWidth=1.25;
  ctx.shadowColor='rgba(232,248,253,.14)';
  ctx.shadowBlur=2.4;
  ctx.beginPath();
  ctx.moveTo(61,24);
  ctx.bezierCurveTo(62.7,46,63.2,76,61.4,110);
  ctx.stroke();
  ctx.restore();
}

export function drawGlassShine(ctx:CanvasRenderingContext2D){
  ctx.save();
  ctx.translate(15,79);
  ctx.scale(.26,1);
  const g=ctx.createRadialGradient(0,0,0,0,0,70);
  g.addColorStop(0,'rgba(236,249,255,.157)');
  g.addColorStop(.34,'rgba(236,249,255,.101)');
  g.addColorStop(.72,'rgba(236,249,255,.028)');
  g.addColorStop(1,'rgba(236,249,255,0)');
  ctx.fillStyle=g;
  ctx.fillRect(-70,-70,140,140);
  ctx.restore();
}

// Bake the same accepted artwork once per renderer; no Pixi dependency in fallback.
function artwork(draw:(ctx:CanvasRenderingContext2D)=>void,surface=false){
  const canvas=document.createElement('canvas');canvas.width=surface?136:360;canvas.height=surface?316:460;
  const ctx=canvas.getContext('2d')!;ctx.save();ctx.scale(2,2);if(!surface)ctx.translate(90,36);draw(ctx);ctx.restore();return canvas;
}
export function makeGlassArtwork(){return{shadow:artwork(drawBodyShadow),rim:artwork(drawGlassRim),base:artwork(drawGlassBase,true),edge:artwork(drawGlassEdge,true),reflection:artwork(drawGlassShine,true)};}
export function makeRadialArtwork(){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!,g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#ffffff');g.addColorStop(.3,'#ffffffb3');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return canvas;}
export function makeSweepArtwork(){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!,g=ctx.createLinearGradient(0,0,128,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.35,'#ffffff00');g.addColorStop(.5,'#ffffff');g.addColorStop(.65,'#ffffff00');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return canvas;}
