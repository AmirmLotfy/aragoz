import type { StageMetrics } from './theatre';
export class PerformanceRecorder {
  private start=performance.now();
  private histogram=new Uint32Array(2001);
  private samples=0;
  private totalMs=0;
  private pausedFrames=0;
  private longest=0;
  private peakTriangles=0;
  private peakDrawCalls=-1;
  frame(milliseconds:number,paused:boolean,metrics:StageMetrics|null):void{
    if(paused){this.pausedFrames++;return;}
    if(!Number.isFinite(milliseconds)||milliseconds<=0)return;
    this.samples++;this.totalMs+=milliseconds;this.longest=Math.max(this.longest,milliseconds);this.histogram[Math.min(2000,Math.round(milliseconds))]++;
    if(metrics){this.peakTriangles=Math.max(this.peakTriangles,metrics.triangles);this.peakDrawCalls=Math.max(this.peakDrawCalls,metrics.drawCalls);}
  }
  report(extra:Record<string,unknown>):Record<string,unknown>{
    let running=0,p95=0;for(let i=0;i<this.histogram.length;i++){running+=this.histogram[i];if(running>=this.samples*0.95){p95=i;break;}}
    return{schemaVersion:1,evidence:'local browser telemetry; OBS and human acceptance unverified',createdAt:new Date().toISOString(),observationSpanMs:performance.now()-this.start,activeFrameSamples:this.samples,pausedFrames:this.pausedFrames,meanFrameMs:this.samples?this.totalMs/this.samples:null,p95FrameMs:this.samples?p95:null,longestFrameMs:this.longest,peakVisibleTriangles:this.peakTriangles,peakObservedDrawCalls:this.peakDrawCalls<0?null:this.peakDrawCalls,userAgent:navigator.userAgent,...extra};
  }
  download(extra:Record<string,unknown>):void{
    const blob=new Blob([JSON.stringify(this.report(extra),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='aragoz-local-performance-'+new Date().toISOString().replaceAll(':','-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
}
