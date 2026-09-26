import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=rel=>fs.readFileSync(new URL(rel,import.meta.url),'utf8');

test('glass wall and glow paths stay open while fill/mask paths stay closed',()=>{
  const glass=read('../src/render/pixi/GlassView.ts');
  const assets=read('../src/render/pixi/assets.ts');
  const openContext=glass.slice(glass.indexOf('function openWallContext'),glass.indexOf('function outline'));
  const closedContext=glass.slice(glass.indexOf('function closedGlassContext'),glass.indexOf('function openWallContext'));
  const openGlow=assets.slice(assets.indexOf('function drawOpenWallPath'),assets.indexOf('function drawRim'));
  const closedGlow=assets.slice(assets.indexOf('function drawClosedGlassPath'),assets.indexOf('function drawOpenWallPath'));
  assert.doesNotMatch(openContext,/closePath/);
  assert.match(closedContext,/closePath/);
  assert.doesNotMatch(openGlow,/closePath/);
  assert.match(closedGlow,/closePath/);
  assert.match(glass,/new Graphics\(openWallContext\(\)\)/);
  assert.match(glass,/new Graphics\(closedGlassContext\(\)\)/);
  assert.match(assets,/drawOpenWallPath\(ctx\);\s*ctx\.stroke\(\);\s*drawRim/);
});

test('stream is retained, Canvas-profile halo follows stream fade, and impact alpha remains separate',()=>{
  const stream=read('../src/render/pixi/StreamView.ts');
  const assets=read('../src/render/pixi/assets.ts');
  assert.doesNotMatch(stream,/\.clear\(\)/);
  assert.match(stream,/makeStreamHaloTexture\(\)/);
  assert.match(stream,/makeStreamHaloCapTexture\(\)/);
  assert.match(stream,/this\.halo\.update\(this\.center,this\.normals,color,stream\.alpha\)/);
  assert.match(assets,/ctx\.shadowBlur=STREAM_BLUR/);
  assert.match(assets,/globalCompositeOperation='destination-out'/);
  assert.match(stream,/this\.mesh\.alpha=\.24\*impact/);
  assert.match(stream,/mt\*mt\*sx\+2\*mt\*t\*cx\+t\*t\*ex/);
});

test('DPR-sensitive glow bake and wave highlight normal coverage stay retained',()=>{
  const assets=read('../src/render/pixi/assets.ts');
  const liquid=read('../src/render/pixi/LiquidView.ts');
  assert.match(assets,/cappedDensity\(\)/);
  assert.match(assets,/makeGlowTexture[\s\S]*cappedDensity\(\)/);
  assert.match(liquid,/const tx=layer\.surface\[n\]-layer\.surface\[p\],ty=layer\.surface\[n\+1\]-layer\.surface\[p\+1\]/);
  assert.match(liquid,/const ox=-ty\/length\*\.725,oy=tx\/length\*\.725/);
  assert.doesNotMatch(liquid,/this\.lineVertices\[o\+1\]=y-\.725/);
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
  assert.match(liquid,/fillGeometry\.destroy\(true\);lineGeometry\.destroy\(true\)/);
  assert.match(stream,/private haloTexture=makeStreamHaloTexture\(\)/);
  assert.match(stream,/private haloCapTexture=makeStreamHaloCapTexture\(\)/);
  assert.match(stream,/geometry\.destroy\(true\)/);
  assert.match(stream,/this\.haloTexture\.destroy\(true\);this\.haloCapTexture\.destroy\(true\)/);
});

test('explicit Canvas fallback covers liquid, transform, stream and impact primitives',()=>{
  const stage=read('../src/render/StageRenderer.ts');
  const canvas=read('../src/render/CanvasRenderer.ts');
  assert.match(stage,/selectBackend\(hasWebGL\)/);
  assert.match(stage,/new CanvasRenderer\(\)/);
  assert.match(canvas,/ctx\.rotate\(frame\.pose\.angle\)/);
  assert.match(canvas,/layer\.wavy&&layer\.surface/);
  assert.match(canvas,/quadraticCurveTo\(stream\.control\.x,stream\.control\.y,stream\.end\.x,stream\.end\.y\)/);
  assert.match(canvas,/ctx\.lineCap='round'/);
  assert.match(canvas,/ctx\.ellipse\(stream\.end\.x,stream\.end\.y\+1\.5/);
  assert.match(canvas,/frame\.hintRole==='source'/);
});
