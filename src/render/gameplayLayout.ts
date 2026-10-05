import type {SceneProfile} from '../core/sceneGeometry.ts';
export function gameplayLayout(viewportWidth:number,height:number,count:number){
 const width=Math.min(viewportWidth,height*.5,430),glassWidth=Math.min(viewportWidth*.19,height*.085,92),scale=glassWidth/66;
 const rows=count<=3?[count,0]:count===4?[2,2]:count===5?[3,2]:count===6?[3,3]:[4,count-4];
 const homes=rows.flatMap((n,row)=>Array.from({length:n},(_,column)=>({x:width*(.5+(column-(n-1)/2)*.23),y:height*(row?.79:.555)-156*scale*(row?1:.92),scale:row?1:.92,row})));
 const profile:SceneProfile={width:width/scale,height:height/scale,pixelScale:scale,homes:homes.map(p=>({...p,x:p.x/scale,y:p.y/scale})),selectMs:140,lift:156*.12};
 return {width,height,glassWidth,scale,homes,profile};
}
