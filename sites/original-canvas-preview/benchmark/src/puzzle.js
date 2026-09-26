// Minimal original pour rule, unchanged.
export const CAPACITY = 4;
export const COLORS = ['#efb94e', '#ef777d', '#42cbbd', '#a28aeb'];
export const clone = (board) => board.map((glass) => [...glass]);

export function pour(board, source, target) {
  const from = board[source], to = board[target];
  if (source === target || !from?.length || !to || to.length === CAPACITY) return null;
  const color = from.at(-1);
  if (to.length && to.at(-1) !== color) return null;
  let amount = 1;
  while (amount < from.length && from[from.length - amount - 1] === color) amount++;
  amount = Math.min(amount, CAPACITY - to.length);
  const next = clone(board);
  next[source].splice(-amount);
  next[target].push(...Array(amount).fill(color));
  return { board: next, amount, color };
}
