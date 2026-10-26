import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Store } from './store.ts';
import { configFromEnv } from './config.ts';
// Internal CLI only: node --env-file-if-exists=.env apps/server/src/backup.ts /absolute/backup.sqlite
const destination=process.argv[2];if(!destination)throw new Error('Supply a new backup destination');
const config=configFromEnv();if(!existsSync(config.databasePath))throw new Error('Source database does not exist');if(existsSync(destination)||resolve(destination)===resolve(config.databasePath))throw new Error('Backup destination must be new');
const store=new Store(config.databasePath,config.tokenEncryptionKey);try{await store.backup(resolve(destination));console.log('Database backup completed');}finally{store.close();}
