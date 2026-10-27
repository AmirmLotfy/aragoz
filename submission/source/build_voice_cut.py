#!/usr/bin/env python3
"""Align owner-supplied narration locally; no network or audio-device access.

Inputs and voice-derived exports stay in an ignored workspace directory. The
provided script supplies spelling, while local ASR supplies timing estimates.
No words are synthesized, voice cloned, or speech time-stretched.
"""
from pathlib import Path
import argparse, difflib, hashlib, importlib.util, json, re, subprocess, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WINDOWS = [(0,8),(8,16),(16,32),(32,60),(60,75),(75,97),(97,112),(112,139),(139,151),(151,160)]

def norm(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?",text.lower().replace('’',"'"))

def run(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-3000:])
    return p

def measure(path):
    p=run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'])
    return json.loads(p.stderr[p.stderr.rfind('{'):p.stderr.rfind('}')+1])

def main():
    a=argparse.ArgumentParser();a.add_argument('--input',required=True);a.add_argument('--recognition',required=True);a.add_argument('--silences',required=True);a.add_argument('--output',required=True);a.add_argument('--align-only',action='store_true');args=a.parse_args()
    source=Path(args.input).resolve();out=Path(args.output).resolve()
    assert out.is_relative_to(ROOT/'.runtime'), 'Voice production must stay in ignored .runtime until publication review.'
    out.mkdir(parents=True,exist_ok=True)
    text=(ROOT/'submission/VOICEOVER_READ.txt').read_text();paragraphs=text.strip().split('\n\n')
    expected=[];word_ranges=[];para_indices=[]
    for pi,p in enumerate(paragraphs):
        para_indices.append(len(expected));ranges=[]
        for word in p.split():
            start=len(expected);expected.extend(norm(word));ranges.append((start,len(expected)-1,word))
        word_ranges.append(ranges)
    asr=json.loads(Path(args.recognition).read_text());heard=[];times=[]
    for s in asr['transcription']:
        words=norm(s['text'])
        for wi,w in enumerate(words):
            heard.append(w);dt=(s['offsets']['to']-s['offsets']['from'])/1000
            times.append((s['offsets']['from']/1000+dt*wi/max(1,len(words)),s['offsets']['from']/1000+dt*(wi+1)/max(1,len(words))))
    matcher=difflib.SequenceMatcher(a=expected,b=heard,autojunk=False);spans=[None]*len(expected);anchors={};diff=[]
    for kind,ea,eb,ha,hb in matcher.get_opcodes():
        if kind=='equal':
            for ei,hi in zip(range(ea,eb),range(ha,hb)): spans[ei]=times[hi];anchors[ei]=hi
        else: diff.append({'kind':kind,'script':' '.join(expected[ea:eb]),'localASR':' '.join(heard[ha:hb]),'inputStart':times[ha][0] if ha<len(times) else None})
    ratio=len(anchors)/len(expected)
    assert ratio>=0.85, f'Unexpected speech/script mismatch ({ratio:.1%}); inspect rather than invent a narration.'
    i=0
    while i<len(spans):
        if spans[i] is not None: i+=1;continue
        lo=i
        while i<len(spans) and spans[i] is None: i+=1
        hi=i;prev=anchors.get(lo-1,-1);next_=anchors.get(hi,len(heard))
        begin=times[prev+1][0] if prev+1<next_ else (spans[lo-1][1] if lo else 0)
        end=times[next_-1][1] if prev+1<next_ else (spans[hi][0] if hi<len(spans) else begin+0.3)
        end=max(begin+0.08*(hi-lo),end)
        for k in range(lo,hi): spans[k]=(begin+(end-begin)*(k-lo)/(hi-lo),begin+(end-begin)*(k-lo+1)/(hi-lo))
    with wave.open(str(source)) as f:
        assert f.getnchannels()==1 and f.getsampwidth()==2, 'Convert explicitly before this step.'
        rate=f.getframerate();raw=np.frombuffer(f.readframes(f.getnframes()),np.int16).astype(np.float64)/32768
    duration=len(raw)/rate;sr=48000;resampled=np.interp(np.arange(round(duration*sr))/sr,np.arange(len(raw))/rate,raw)
    log=Path(args.silences).read_text()
    silent=list(zip([float(v) for v in re.findall(r'silence_start: ([0-9.]+)',log)],[float(v) for v in re.findall(r'silence_end: ([0-9.]+)',log)]))
    def safe_cut(t):
        for lo,hi in silent:
            if lo<=t<=hi: return max(lo+0.025,min(hi-0.025,t))
        candidates=[(lo,hi) for lo,hi in silent if min(abs(lo-t),abs(hi-t))<=0.75]
        assert candidates, f'No safe silent edit near{t}; inspect rather than cut a syllable.'
        lo,hi=min(candidates,key=lambda pair:min(abs(pair[0]-t),abs(pair[1]-t)))
        return (lo+hi)/2
    boundaries=[0]+[safe_cut((spans[ranges[-1][1]][1]+spans[word_ranges[pi+1][0][0]][0])/2) for pi,ranges in enumerate(word_ranges[:-1])]+[duration]
    aligned=np.zeros(160*sr);takes=[];cues=[];previous_end=0
    for pi,((window_a,window_b),ranges) in enumerate(zip(WINDOWS,word_ranges)):
        first=ranges[0][0];last=ranges[-1][1]
        cut_a=boundaries[pi];cut_b=boundaries[pi+1]
        clip=resampled[round(cut_a*sr):round(cut_b*sr)].copy();seconds=len(clip)/sr
        place=min(window_a+0.1,window_b-seconds-0.1);place=max(previous_end+0.06,place) if pi else max(0,place)
        split_time=None;extra=0
        # Let the steam counter breathe; start the echo narration on its picture cut.
        split_word=next((wi for wi,w in enumerate(ranges) if w[2].lower()=='delayed'),None) if pi==5 else None
        if split_word is not None:
            token=ranges[split_word][0];split_time=safe_cut((spans[token-1][1]+spans[token][0])/2)
            extra=max(0,86-(place+spans[token][0]-cut_a));at=round((split_time-cut_a)*sr)
            clip=np.concatenate([clip[:at],np.zeros(round(extra*sr)),clip[at:]]);seconds=len(clip)/sr
        assert place+seconds<=window_b+0.25, f'Take{pi+1} needs a picture retime; never silently speed speech.'
        assert place+seconds<=160
        fade=min(240,len(clip)//4);clip[:fade]*=np.linspace(0,1,fade);clip[-fade:]*=np.linspace(1,0,fade)
        start=round(place*sr);aligned[start:start+len(clip)]=clip;previous_end=(start+len(clip))/sr
        takes.append({'take':pi+1,'inputStart':round(cut_a,3),'inputEnd':round(cut_b,3),'outputStart':round(place,3),'outputEnd':round(previous_end,3),'speed':1.0,'insertedGameplayPause':round(extra,3),'editsInDetectedSilence':True})
        groups=[ranges] if split_word is None else [ranges[:split_word],ranges[split_word:]]
        chunks=[group[k:k+11] for group in groups for k in range(0,len(group),11)]
        def mapped(t): return place+t-cut_a+(extra if split_time is not None and t>=split_time else 0)
        for g in chunks:
            a_=max(place,mapped(spans[g[0][0]][0])-0.08);b_=min(previous_end+0.05,mapped(spans[g[-1][1]][1])+0.12)
            cues.append({'start':round(a_,3),'end':round(max(a_+0.15,b_),3),'text':' '.join(w[2] for w in g)})
    for a_,b_ in zip(cues,cues[1:]): a_['end']=min(a_['end'],b_['start'])
    with wave.open(str(out/'voice-aligned.wav'),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(np.clip(aligned*32767,-32768,32767).astype('<i2').tobytes())
    alignment={'kind':'local-ASR-assisted-script-alignment','inputDuration':duration,'scriptWords':len(text.split()),'exactNormalizedTokenMatch':ratio,'differences':diff,'takes':takes,'captions':cues,'limits':'ASR timestamps are estimates, not human word-level certification. Script spelling retained; no synthesized/replaced speech.'}
    (out/'ALIGNMENT.json').write_text(json.dumps(alignment,indent=2)+'\n')
    print(json.dumps({'matchedNormalizedTokens':ratio,'takes':takes,'captionCues':len(cues)}),flush=True)
    if args.align_only: return
    spec=importlib.util.spec_from_file_location('picture',ROOT/'submission/source/build_video.py');picture=importlib.util.module_from_spec(spec);spec.loader.exec_module(picture)
    picture.WORK=out/'work';picture.OUT=out;picture.prepare(caption_overrides=cues,voice_ready=True);picture.render()
    loud=measure(out/'voice-aligned.wav')
    filters=f'highpass=f=70,lowpass=f=10000,loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={loud["input_i"]}:measured_TP={loud["input_tp"]}:measured_LRA={loud["input_lra"]}:measured_thresh={loud["input_thresh"]}:offset={loud["target_offset"]}:linear=true'
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(out/'voice-aligned.wav'),'-af',filters,'-ar','48000','-c:a','pcm_s16le',str(out/'voice-normalized.wav')])
    video=out/'aragoz-vo-review-160s.mp4'
    mix='[1:a]asplit=2[voice][side];[2:a]volume=0.5[bed];[bed][side]sidechaincompress=threshold=0.015:ratio=8:attack=10:release=200[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.8913:level=false:latency=1,aformat=channel_layouts=stereo[mix]'
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(out/'aragoz-review-picture.mp4'),'-i',str(out/'voice-normalized.wav'),'-i',str(out/'work/original-editorial-bed.wav'),'-filter_complex',mix,'-map','0:v:0','-map','[mix]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','160','-metadata','title=ARAGOZ — narrated review cut','-movflags','+faststart',str(video)])
    final_loud=measure(video)
    if abs(float(final_loud['input_i'])+16)>0.3:
        gain=min(-16-float(final_loud['input_i']),-1.2-float(final_loud['input_tp']))
        adjusted=mix.replace('alimiter=',f'volume={gain}dB,alimiter=')
        run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(out/'aragoz-review-picture.mp4'),'-i',str(out/'voice-normalized.wav'),'-i',str(out/'work/original-editorial-bed.wav'),'-filter_complex',adjusted,'-map','0:v:0','-map','[mix]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','160','-metadata','title=ARAGOZ — narrated review cut','-movflags','+faststart',str(video)])
        final_loud=measure(video)
    run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'])
    receipt={'kind':'owner-supplied-VO-local-review-mix','sourcePath':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceDuration':duration,'sourceRate':rate,'file':str(video),'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'duration':160,'voiceTimeStretch':False,'synthesizedSpeech':False,'paidCalls':0,'voiceUploaded':False,'recognition':'offline whisper.cpp with tiny.en; timing estimates manually scoped against script','exactNormalizedTokenMatch':ratio,'finalLoudness':final_loud,'fullDecodeNoErrors':True,'captions':'aragoz-review-en.srt','takes':takes,'pending':['genuine continuous Twitch motion','actual Codex-workflow footage','authenticated Devpost form/access/final publication approval']}
    (out/'VOICE_MIX_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'voiceVideo':str(video),'bytes':video.stat().st_size,'loudness':final_loud}),flush=True)

if __name__=='__main__': main()
