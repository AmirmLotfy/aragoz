import { statfsSync, mkdirSync, writeFileSync } from 'node:fs';
const stats = statfsSync(process.cwd());
const freeGiB = Number(stats.bavail) * Number(stats.bsize) / 1024 ** 3;
const profiles={install:1024,verify:128,build:512,browser:384,blender:768,inspect:0};
const args=process.argv.slice(2),job=args.includes('--job')?args[args.indexOf('--job')+1]:'inspect';
if(!(job in profiles))throw new Error('Unknown resource job');
const estimatedMiB=profiles[job],reserveMiB=256,minimumGiB=(estimatedMiB+reserveMiB)/1024;
const result={workspace:process.cwd(),job,freeGiB:Number(freeGiB.toFixed(2)),estimatedMiB,reserveMiB,minimumGiB,admitted:freeGiB>=minimumGiB,policy:'26Oct user override: bounded next-job estimate, no fixed10GiB floor'};
console.log(JSON.stringify(result));
if(process.argv.includes('--record')){mkdirSync('evidence',{recursive:true});writeFileSync('evidence/resource-gate.json',JSON.stringify(result,null,2)+'\n');}
if (freeGiB < minimumGiB) process.exitCode = 75;
