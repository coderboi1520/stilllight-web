export type Category='background'|'cap'|'glass';
export type Cosmetic={id:string;category:Category;name:string;price:number;description:string;color:string};
export const CATALOG:readonly Cosmetic[]=[
 {id:'bg-conservatory',category:'background',name:'Moonlit conservatory',price:0,description:'Home only · ivory lilies and moonlight',color:'#193849'},
 {id:'bg-indigo',category:'background',name:'Indigo night',price:75,description:'Home only · cool indigo atmosphere',color:'#35477c'},
 {id:'bg-amber',category:'background',name:'Brass twilight',price:100,description:'Home only · warm brass atmosphere',color:'#796746'},
 {id:'cap-pumpkin',category:'cap',name:'Golden pumpkin',price:0,description:'The original pumpkin finish',color:'#d9ad61'},
 {id:'cap-pearl',category:'cap',name:'Moon pearl',price:60,description:'A pale silver finish on the original cap',color:'#dae6ef'},
 {id:'cap-jade',category:'cap',name:'Jade patina',price:90,description:'A soft jade finish on the original cap',color:'#87c9b3'},
 {id:'glass-clear',category:'glass',name:'Atelier clear',price:0,description:'The original transparent glass',color:'#cde9ee'},
 {id:'glass-rose',category:'glass',name:'Rose crystal',price:60,description:'Rose tinted reflections, clear liquids',color:'#edc1d5'},
 {id:'glass-ice',category:'glass',name:'Glacier crystal',price:90,description:'Cool blue reflections, clear liquids',color:'#addafa'},
];
export const DEFAULT_EQUIPPED={background:'bg-conservatory',cap:'cap-pumpkin',glass:'glass-clear'};
export const cosmetic=(id:string)=>{const c=CATALOG.find(c=>c.id===id);if(!c)throw Error('Unknown cosmetic');return c;};
export function finishColors(equipped:Record<Category,string>){return{cap:equipped.cap==='cap-pearl'?'#dae6ef':equipped.cap==='cap-jade'?'#87c9b3':'#ffffff',glass:equipped.glass==='glass-clear'?'#ffffff':cosmetic(equipped.glass).color};}
