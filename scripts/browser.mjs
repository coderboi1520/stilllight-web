import {chromium} from 'playwright-core';
import {access,mkdir} from 'node:fs/promises';
import path from 'node:path';
export {chromium};
export async function browserPath(){
 const paths=[process.env.CHROMIUM_PATH,chromium.executablePath()];
 for(const base of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean))paths.push(path.join(base,'Google/Chrome/Application/chrome.exe'),path.join(base,'Microsoft/Edge/Application/msedge.exe'));
 for(const candidate of paths.filter(Boolean)){try{await access(candidate);return candidate;}catch{}}
 throw Error('Chromium unavailable. Set CHROMIUM_PATH to an installed Chromium, Chrome or Edge executable.');
}
export async function artifactDirectory(name){const directory=path.resolve('artifacts/verification/claude-implementation',name);await mkdir(directory,{recursive:true});return directory;}
export const url=process.env.STILLLIGHT_URL??'http://127.0.0.1:5194/';
