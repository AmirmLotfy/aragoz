/** Keep presentation deadlines on a stable phase; callback jitter must not drift them. */
export class PresentationClock {
  private nextAt:number;
  constructor(now:number,private fps:number){this.nextAt=now+1000/fps;}
  due(now:number,fps:number,force=false):boolean{
    const period=1000/fps,tolerance=1;
    if(fps!==this.fps){this.fps=fps;this.nextAt=now;}
    if(!force&&now+tolerance<this.nextAt)return false;
    this.nextAt=force?now+period:this.nextAt+Math.max(1,Math.floor((now+tolerance-this.nextAt)/period)+1)*period;
    return true;
  }
}
