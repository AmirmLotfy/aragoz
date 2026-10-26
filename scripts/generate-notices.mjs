import{readFile,writeFile,mkdir}from'node:fs/promises';
const packages=['react','react-dom','@babylonjs/core','@babylonjs/loaders','zod'];
const sections=['ARAGOZ third-party software notices\n\nGame content and project source rights are separate from the following dependencies. Noto font notices are also available in /fonts.'];
for(const name of packages){const dir='node_modules/'+name,metadata=JSON.parse(await readFile(dir+'/package.json','utf8'));const files=name.startsWith('@babylonjs/')?['license.md','NOTICE.md']:['LICENSE'];sections.push(`${name} ${metadata.version}`);for(const file of files){try{sections.push(await readFile(dir+'/'+file,'utf8'));}catch(error){if(file==='NOTICE.md'&&error.code==='ENOENT')continue;throw error;}}}
await mkdir('apps/web/public',{recursive:true});await writeFile('apps/web/public/third-party-notices.txt',sections.join('\n\n--------------------\n\n')+'\n');console.log('Packaged locked browser dependency license notices.');
