export function backdropLayout(host:HTMLElement,width:number,height:number,imageWidth:number,imageHeight:number){
  const atelier=host.closest<HTMLElement>('.atelier');if(!atelier||atelier.classList.contains('reference'))return null;
  const room=atelier.getBoundingClientRect(),board=host.getBoundingClientRect();
  const scale=Math.max(room.width/imageWidth,room.height/imageHeight);
  const w=imageWidth*scale,h=imageHeight*scale;
  // Register the board scene to the same cover image as its surrounding atelier.
  return{x:(room.width-w)/2-(board.left-room.left),y:(room.height-h)/2-(board.top-room.top),width:w,height:h,viewWidth:width,viewHeight:height};
}
