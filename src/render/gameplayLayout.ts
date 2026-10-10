import type {SceneProfile} from '../core/sceneGeometry.ts';
export function gameplayLayout(viewportWidth:number,height:number,count:number){
 const width=Math.min(viewportWidth,Math.max(height*.5,320),430),glassWidth=count<=3?Math.min(width*.22,height*.125,100):Math.min(width*.17,height*.085,92),scale=glassWidth/66;
 const rows=count<=3?[count,0]:count===4?[2,2]:count===5?[3,2]:count===6?[3,3]:[4,count-4];
 const homes=rows.flatMap((n,row)=>Array.from({length:n},(_,column)=>({x:width*(.5+(column-(n-1)/2)*(count<=3?(count===2?.38:.30):.23)),y:height*(count<=3?.62:row?.79:.555)-156*scale*(count<=3?1:row?1:.92),scale:count<=3?1:row?1:.92,row})));
 const profile:SceneProfile={width:width/scale,height:height/scale,pixelScale:scale,homes:homes.map(p=>({...p,x:p.x/scale,y:p.y/scale})),selectMs:200,lift:156*.12};
 return {width,height,glassWidth,scale,homes,profile};
}
