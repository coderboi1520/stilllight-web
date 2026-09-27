import { CAPACITY,COLORS } from './constants.ts';
export { CAPACITY,COLORS }; export const clone=(board:number[][])=>board.map(g=>[...g]);
export const isBottleComplete=(layers:readonly number[])=>layers.length===CAPACITY&&layers.length>0&&layers.every(color=>color===layers[0]);
export function pour(board:number[][],source:number,target:number){const from=board[source],to=board[target];if(source===target||!from?.length||!to||to.length===CAPACITY)return null;const color=from.at(-1)!;if(to.length&&to.at(-1)!==color)return null;let amount=1;while(amount<from.length&&from[from.length-amount-1]===color)amount++;amount=Math.min(amount,CAPACITY-to.length);const next=clone(board);next[source].splice(-amount);next[target].push(...Array(amount).fill(color));return{board:next,amount,color};}
