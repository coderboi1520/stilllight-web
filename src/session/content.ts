import {ORDINARY_COMMISSION} from '../core/ordinaryCommission.ts';
export const ROOM={id:'moonlit-atelier',name:'Moonlit Atelier'};
export type Commission={id:string;name:string;teaching:string;contribution:string;board:number[][]};
export const COMMISSIONS:readonly Commission[]=[
 {id:'ma-first-light',name:'First light',teaching:'Choose a vessel, then a matching top or an empty vessel. Each pour moves the whole matching run that fits.',contribution:'The left lily pane transmits moonlight.',board:[[0,0,1,1],[1,1,0,0],[],[],[],[]]},
 {id:'ma-sill-reflection',name:'Sill reflection',teaching:'Make space for matching runs. Undo restores the previous pour; Hint shows a step toward a settled board.',contribution:'Light gathers across the right lily and sill.',board:[[0,0,1,1],[1,1,2,2],[2,2,0,0],[],[],[]]},
 {id:'ma-moon-in-glass',name:'Moon in glass',teaching:'Free pairs can pour together. Each source and receiver stays occupied through recovery.',contribution:'The central moon pane and its reflection are restored.',board:ORDINARY_COMMISSION},
];
export function commission(id:string){const c=COMMISSIONS.find(c=>c.id===id);if(!c)throw Error('Unknown commission');return c;}
