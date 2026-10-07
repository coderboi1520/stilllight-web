import {writeFile} from 'node:fs/promises';
import {buildAmbientLoop} from '../src/platform/music.ts';
// Reproduce the original score asset without any external audio toolchain.
const rate=22050,samples=buildAmbientLoop(rate),data=Buffer.alloc(44+samples.length*2);
data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples.length*2,40);
for(let i=0;i<samples.length;i++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
await writeFile(new URL('../public/assets/moonlit-ambient.wav',import.meta.url),data);
console.log(`Original ambient score: ${samples.length/rate}s, ${data.length} bytes, mono PCM16 ${rate}Hz`);
