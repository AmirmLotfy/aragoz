import { createRequire } from 'node:module';
import { readdirSync,readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve,relative } from 'node:path';
const require=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..');
const ts=require(process.env.ARAGOZ_TYPESCRIPT_PATH??'typescript');
const files=[];
function scan(path){for(const item of readdirSync(path,{withFileTypes:true})){if(['node_modules','dist'].includes(item.name))continue;const file=resolve(path,item.name);if(item.isDirectory())scan(file);else if(/\.tsx?$/.test(item.name))files.push(file);}}
for(const path of ['apps','packages','tests'])scan(resolve(root,path));
for(const file of ['vitest.config.ts','playwright.config.ts'])files.push(resolve(root,file));
const diagnostics=[];
for(const file of files){const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const d of source.parseDiagnostics){const point=source.getLineAndCharacterOfPosition(d.start??0);diagnostics.push({file:relative(root,file),line:point.line+1,column:point.character+1,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});}}
const result={kind:'syntax-only',typescript:ts.version,files:files.map(f=>relative(root,f)).sort(),passed:diagnostics.length===0,diagnostics,note:'Parser validation only. Does not resolve dependencies, typecheck, build, execute tests or validate runtime/provider/hosted behavior.'};
mkdirSync(resolve(root,'evidence'),{recursive:true});writeFileSync(resolve(root,'evidence/source-syntax.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({kind:result.kind,typescript:result.typescript,fileCount:files.length,passed:result.passed,diagnostics},null,2));if(diagnostics.length)process.exitCode=1;
