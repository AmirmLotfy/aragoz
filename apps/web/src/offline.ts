import { EncounterEventSchema } from '@aragoz/contracts';
import type { EncounterEvent } from '@aragoz/contracts';
export class EventOutbox {
  private items:EncounterEvent[]=[];
  persistenceAvailable=true;
  constructor(private key:string){
    try{const parsed=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(parsed))this.items=parsed.flatMap(v=>{const p=EncounterEventSchema.safeParse(v);return p.success?[p.data]:[];});}catch{this.persistenceAvailable=false;}
  }
  append(events:EncounterEvent[]):void{for(const event of events)if(!this.items.some(e=>e.attemptId===event.attemptId&&e.sequence===event.sequence))this.items.push(event);this.save();}
  pending(attemptId:string):EncounterEvent[]{return this.items.filter(e=>e.attemptId===attemptId).slice(0,128);}
  count(attemptId:string):number{return this.items.filter(e=>e.attemptId===attemptId).length;}
  historicalCount(activeId:string):number{return this.items.filter(e=>e.attemptId!==activeId).length;}
  acknowledge(batch:EncounterEvent[]):void{const ids=new Set(batch.map(e=>e.attemptId+':'+e.sequence));this.items=this.items.filter(e=>!ids.has(e.attemptId+':'+e.sequence));this.save();}
  private save():void{try{localStorage.setItem(this.key,JSON.stringify(this.items));this.persistenceAvailable=true;}catch{this.persistenceAvailable=false;}}
}
export function clientIdentity():string{try{let id=sessionStorage.getItem('aragoz.client.v1');if(!id){id=crypto.randomUUID();sessionStorage.setItem('aragoz.client.v1',id);}return id;}catch{return crypto.randomUUID();}}
