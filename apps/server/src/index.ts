import { createApp } from './app.ts';
import { configFromEnv } from './config.ts';
export { createApp } from './app.ts';

const config=configFromEnv();
const app=await createApp(config);
await app.listen({port:config.port,host:config.host});
console.log(`ARAGOZ listening at ${config.origin}`);
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
