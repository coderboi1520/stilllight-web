import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=rel=>fs.readFileSync(new URL(rel,import.meta.url),'utf8');

test('glass wall/glow stay open while body, mask and shadow close on the curved front-rim boundary',()=>{
  const glass=read('../src/render/pixi/GlassView.ts');
  const assets=read('../src/render/pixi/assets.ts');
  const openContext=glass.slice(glass.indexOf('function openWallContext'),glass.indexOf('function outline'));
  const interiorContext=glass.slice(glass.indexOf('function interiorGlassContext'),glass.indexOf('function openWallContext'));
  const openGlow=assets.slice(assets.indexOf('function drawOpenWallPath'),assets.indexOf('function drawRim'));
  const interiorShadow=assets.slice(assets.indexOf('function drawInteriorGlassPath'),assets.indexOf('function drawOpenWallPath'));
  assert.doesNotMatch(openContext,/closePath/);
  assert.match(interiorContext,/closePath/);
  assert.doesNotMatch(openGlow,/closePath/);
  assert.match(interiorShadow,/closePath/);
  for(const text of [interiorContext,interiorShadow]){
    assert.match(text,/bezierCurveTo\(-33,2\.485,-18\.225,4\.5,0,4\.5\)/);
    assert.match(text,/bezierCurveTo\(18\.225,4\.5,33,2\.485,33,0\)/);
  }
  assert.match(glass,/private body=new Graphics\(interiorGlassContext\(\)\)/);
  assert.match(glass,/private clip=new Graphics\(interiorGlassContext\(\)\)\.fill\(0xffffff\)/);
  assert.match(assets,/drawOpenWallPath\(ctx\);\s*ctx\.stroke\(\);\s*drawRim/);
  const shadow=assets.slice(assets.indexOf('export function makeBodyShadowTexture'),assets.indexOf('export function makeGlowTexture'));
  assert.match(shadow,/drawInteriorGlassPath\(ctx\);\s*ctx\.fill\(\)/);
  assert.doesNotMatch(glass,/closedGlassContext/);
  assert.doesNotMatch(assets,/drawClosedGlassPath/);
});

test('Pixi glass material stays behind the curved front rim in a retained local mask',()=>{
  const glass=read('../src/render/pixi/GlassView.ts');
  const interior=glass.slice(glass.indexOf('function interiorGlassContext'),glass.indexOf('function openWallContext'));
  const update=glass.slice(glass.indexOf('  update(frame:GlassFrame)'));
  assert.match(interior,/bezierCurveTo\(-33,2\.485,-18\.225,4\.5,0,4\.5\)/);
  assert.match(interior,/bezierCurveTo\(18\.225,4\.5,33,2\.485,33,0\)/);
  assert.match(glass,/private clip=new Graphics\(interiorGlassContext\(\)\)\.fill\(0xffffff\)/);
  assert.match(glass,/this\.clipped\.addChild\(this\.liquid\.root,this\.baseDepth,this\.reflection,this\.edgeHighlight\)/);
  assert.match(glass,/this\.clipped\.mask=this\.clip/);
  assert.ok(glass.indexOf('this.clipped,...this.glowList,this.normal,this.normalRim')>0);
  assert.doesNotMatch(update,/new Graphics|new Sprite|makeGlass.*Texture/);
});

test('liquid layer meshes terminate at canonical internal boundaries without presentation overdraw',()=>{
  const liquid=read('../src/render/pixi/LiquidView.ts');
  assert.doesNotMatch(liquid,/layer\.bottom\s*\+\s*[12]/);
  assert.match(liquid,/const bottom=layer\.bottom,bottomV=clampDepth\(bottom\),samples=layer\.surface/);
  assert.match(liquid,/const bottom=layer\.bottom,top=layer\.top/);
});

test('stream uses retained tapered strips, reduced halo/core, and authored reveal',()=>{
  const stream=read('../src/render/pixi/StreamView.ts');
  const assets=read('../src/render/pixi/assets.ts');
  assert.doesNotMatch(stream,/\.clear\(\)/);
  assert.match(stream,/makeStreamHaloTexture\(\)/);
  assert.doesNotMatch(stream,/startCap|endCap|makeStreamHaloCapTexture/);
  assert.match(stream,/this\.halo\.update\(this\.center,this\.normals,color,stream\.alpha\*\.38,stream\.widthScale\)/);
  assert.match(stream,/this\.core\.update\(this\.center,this\.normals,'#ffffff',stream\.alpha\*\.30,stream\.widthScale\)/);
  assert.match(assets,/ctx\.shadowBlur=STREAM_BLUR/);
  assert.match(assets,/globalCompositeOperation='destination-out'/);
  assert.match(stream,/colorWidth\(t\)/);
  assert.match(stream,/stream\.reveal\*i\/CURVE_SEGMENTS/);
  assert.match(stream,/mt\*mt\*sx\+2\*mt\*t\*cx\+t\*t\*ex/);
});

test('DPR-sensitive glow bake and wave highlight normal coverage stay retained',()=>{
  const assets=read('../src/render/pixi/assets.ts');
  const liquid=read('../src/render/pixi/LiquidView.ts');
  assert.match(assets,/cappedDensity\(\)/);
  assert.match(assets,/makeGlowTexture[\s\S]*cappedDensity\(\)/);
  assert.match(assets,/makeLiquidDepthTexture/);
  assert.match(liquid,/const tx=samples\[n\]-samples\[p\],ty=samples\[n\+1\]-samples\[p\+1\]/);
  assert.match(liquid,/const ox=-ty\/length\*\.6,oy=tx\/length\*\.6/);
  assert.match(liquid,/this\.waveFill\.geometry\.getBuffer\('aUV'\)\.update\(\)/);
  assert.match(liquid,/this\.flatFill\.geometry\.getBuffer\('aUV'\)\.update\(\)/);
});

test('render hot path does not re-add scene children every frame',()=>{
  const renderer=read('../src/render/pixi/PixiRenderer.ts');
  const renderBody=renderer.slice(renderer.indexOf('render(frame:RenderFrame)'));
  assert.doesNotMatch(renderBody,/addChild/);
  assert.match(renderer,/ensureDrawOrder/);
});

test('Pixi background RAF owners are detached and context restoration retains the view graph',()=>{
  const renderer=read('../src/render/pixi/PixiRenderer.ts');
  assert.match(renderer,/renderer\.events\.setTargetElement\(null\)/);
  assert.match(renderer,/renderer\.gc\.enabled=false/);
  assert.match(renderer,/renderer\.scheduler\.destroy\(\)/);
  assert.match(renderer,/webglcontextrestored/);
  assert.match(renderer,/private restoreHandler=\(\)=>\{this\.onRestore\(\);\}/);
  assert.doesNotMatch(renderer,/restoreHandler=\(\)=>\{this\.rebuildViews/);
  assert.doesNotMatch(renderer,/requestAnimationFrame/);
});

test('DPR view generations retire after replacement render and release private Pixi resources',()=>{
  const renderer=read('../src/render/pixi/PixiRenderer.ts');
  const glass=read('../src/render/pixi/GlassView.ts');
  const liquid=read('../src/render/pixi/LiquidView.ts');
  const stream=read('../src/render/pixi/StreamView.ts');
  assert.match(renderer,/private retiredViews:\(GlassView\|StreamView\)\[\]=\[\]/);
  assert.match(renderer,/this\.app\.renderer\.render\(this\.app\.stage\);this\.destroyRetiredViews\(\)/);
  assert.match(renderer,/this\.glasses\?\.forEach\(view=>view\.destroy\(\)\)/);
  assert.match(glass,/private ownedTextures:Texture\[\]/);
  assert.match(glass,/this\.liquid\.destroy\(\)/);
  assert.match(glass,/for\(const texture of this\.ownedTextures\)texture\.destroy\(true\)/);
  assert.match(liquid,/flatGeometry\.destroy\(true\);fillGeometry\.destroy\(true\);lineGeometry\.destroy\(true\)/);
  assert.match(liquid,/this\.depthTexture\.destroy\(true\)/);
  assert.match(stream,/private haloTexture=makeStreamHaloTexture\(\)/);
  assert.match(stream,/geometry\.destroy\(true\)/);
  assert.match(stream,/this\.haloTexture\.destroy\(true\)/);
});

test('viewport controller explicitly watches DPR-only changes without RAF polling',()=>{
  const viewport=read('../src/render/ViewportController.ts');
  assert.match(viewport,/window\.matchMedia\(`\(resolution: \$\{dpr\}dppx\)`\)/);
  assert.match(viewport,/addEventListener\('change',this\.dprHandler\)/);
  assert.match(viewport,/removeEventListener\('change',this\.dprHandler\)/);
  assert.match(viewport,/private dprHandler=\(\)=>\{this\.bindDprWatcher\(\);this\.sync\(\);\}/);
  assert.doesNotMatch(viewport,/requestAnimationFrame/);
});

test('idle RAF harness resets startup requests before measuring settled idle',()=>{
  const idle=read('../scripts/verification/verify-idle-raf.mjs');
  const settled=idle.slice(idle.indexOf('await harness.goto(page)'),idle.indexOf('const first='));
  assert.match(settled,/waitForFunction\(\(\)=>!!window\.__STILLLIGHT_PIXI__\)/);
  assert.match(settled,/__rafProbe\.reset\(\)/);
});

test('explicit Canvas fallback covers depth, transform, stream and local response primitives',()=>{
  const stage=read('../src/render/StageRenderer.ts');
  const canvas=read('../src/render/CanvasRenderer.ts');
  assert.match(stage,/selectBackend\(hasWebGL\)/);
  assert.match(stage,/new CanvasRenderer\(\)/);
  assert.match(canvas,/ctx\.rotate\(frame\.pose\.angle\)/);
  assert.match(canvas,/layer\.wavy&&layer\.surface/);
  assert.match(canvas,/createLinearGradient\(0,0,0,GLASS_BOTTOM\)/);
  assert.match(canvas,/quadraticCurveTo\(controlX,controlY,endX,endY\)/);
  assert.match(canvas,/ctx\.lineCap='butt'/);
  assert.match(canvas,/ctx\.ellipse\(0,\.6,frame\.response\.spread/);
  assert.match(canvas,/frame\.hintRole==='source'/);
});
