#!/usr/bin/env python3
"""Offline review update from actual supported-browser capture frames.

No browser, provider, audio-device, voice synthesis or game-state access. Raw
captures and narrated exports remain ignored locally; the original edit stays.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, math, shutil, subprocess

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.runtime/submission-motion'
CAPTURES = ROOT / '.runtime/submission-capture'
VOICE_MASTER = ROOT / 'submission/local-review/aragoz-narrated-review.mp4'
SRT = ROOT / 'submission/local-review/aragoz-narrated-en.srt'

def run(args):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-3000:])
    return r.stdout

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def audio_hash(path):
    return run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).strip()

def capture(name, minimum_frames=10):
    matches = sorted(p for p in CAPTURES.glob(name + '-*') if (p/'CAPTURE.json').is_file())
    assert len(matches) == 1, f'Expected one reviewed capture: {name}'
    folder = matches[0]
    j = json.loads((folder/'CAPTURE.json').read_text())
    frames = j['frames']
    assert len(frames) >= minimum_frames, 'Not enough frames for the selected capture category.'
    times = [float(f['metadata']['timestamp']) for f in frames]
    assert all(math.isfinite(t) for t in times) and all(b >= a for a,b in zip(times,times[1:]))
    listing = []
    final_hold = max(1/30, (j['ended']-j['started'])/1000-(times[-1]-times[0]))
    for i,f in enumerate(frames):
        path = folder/f['file']
        assert path.is_file() and path.parent == folder
        listing += [f"file '{path}'",f'duration {max(0.001, times[i+1]-times[i]) if i+1<len(times) else final_hold:.9f}']
    listing.append(f"file '{folder/frames[-1]['file']}'")
    playlist = WORK/(name+'.ffconcat')
    playlist.write_text('\n'.join(listing)+'\n')
    movie = WORK/(name+'.mp4')
    run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(playlist),'-an','-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','18','-threads','2',str(movie)])
    return movie, {'capture':str(folder.relative_to(ROOT)),'manifestSha256':sha(folder/'CAPTURE.json'),'frames':len(frames),'spanSeconds':times[-1]-times[0],'movieSha256':sha(movie)}

def parse_cues():
    cues = []
    def sec(s):
        h,m,rest = s.split(':'); return int(h)*3600+int(m)*60+float(rest.replace(',','.'))
    for block in SRT.read_text().strip().split('\n\n'):
        rows = block.splitlines(); a,b = rows[1].split(' --> ')
        cues.append({'start':sec(a),'end':sec(b),'text':' '.join(rows[2:])})
    assert len(cues) == 33
    return cues

def main(mode):
    WORK.mkdir(parents=True,exist_ok=True)
    assembly, a = capture('twitch-assembly-real')
    breaking, b = capture('encore-charge-break-strikes')
    aftermath, c = capture('encore-steam-overheat')
    source_review, source_receipt = capture('codex-source-review', minimum_frames=3)
    # Same Encore 2, chronological cuts. No synthetic movement or altered game UI.
    montage = WORK/'charge-break-and-absence.mp4'
    run(['ffmpeg','-y','-v','error','-i',str(breaking),'-i',str(aftermath),'-filter_complex_threads','1',
         '-filter_complex','[0:v]trim=start=1.3:end=3.2,setpts=PTS-STARTPTS[a];[1:v]trim=start=1.3:end=6.1,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,tpad=stop_mode=clone:stop_duration=1.3,fps=30,format=yuv420p[v]',
         '-map','[v]','-an','-t','8','-c:v','libx264','-preset','veryfast','-crf','18','-threads','2',str(montage)])
    spec = importlib.util.spec_from_file_location('picture',ROOT/'submission/source/build_video.py')
    picture = importlib.util.module_from_spec(spec); spec.loader.exec_module(picture)
    picture.OUT = WORK/mode
    picture.WORK = picture.OUT/'work'
    overrides = {
        4:{'kind':'video','source':str(assembly.relative_to(ROOT)),'offset':1.3,'crop':None,'label':'ACTUAL TWITCH / 28 OCT / COMMITTED RECIPE / AI-OPERATED'},
        6:{'kind':'video','source':str(montage.relative_to(ROOT)),'offset':0,'crop':None,'label':'ACTUAL TWITCH / ENCORE 2 / EDITED + FINAL FREEZE / AI-OPERATED'},
        7:{'label':'ACCEPTED TWITCH RESULT / SEPARATE 27 OCT TEST / ACTUAL STILL'},
        12:{'kind':'video','source':str(source_review.relative_to(ROOT)),'offset':0,'crop':[0,150,1920,930],'label':'ACTUAL SOURCE / COMMIT REVIEW / CODEX-BUILT PATCH / NOT CODEX APP UI'},
    }
    picture.prepare(caption_overrides=parse_cues() if mode=='captioned' else [],voice_ready=True,scene_overrides=overrides,write_manifest=False,presentation_label='TECHNICAL PREVIEW\nBUILT WITH CODEX')
    clean = picture.render(picture_only=True)
    dest = ROOT/'submission/local-review'/('aragoz-narrated-motion-review.mp4' if mode=='captioned' else 'aragoz-narrated-motion-clean.mp4')
    before = audio_hash(VOICE_MASTER)
    run(['ffmpeg','-y','-v','error','-i',str(clean),'-i',str(VOICE_MASTER),'-map','0:v:0','-map','1:a:0','-c','copy','-metadata','title=ARAGOZ — Twitch demo and Codex-built source review','-movflags','+faststart',str(dest)])
    assert audio_hash(dest) == before
    shutil.copyfile(SRT, dest.parent/'aragoz-narrated-motion-en.srt')
    run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'])
    media = json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','format=duration,size:stream=codec_type,width,height,nb_read_frames,r_frame_rate','-of','json',str(dest)]))
    assert float(media['format']['duration']) == 160 and media['streams'][0]['nb_read_frames'] == '4800'
    receipt = {'date':'2026-10-28','kind':'local-demo-review-with-actual-Twitch-and-source-footage','file':str(dest.relative_to(ROOT)),'sha256':sha(dest),'media':media,'audioPacketHash':before,'audioIdenticalToPriorReview':True,'fullDecodeNoErrors':True,'captures':[a,b,c,source_receipt],'montageSha256':sha(montage),'limits':['Not uploaded or entered.','Actual 28 October Twitch assembly/Encore 2 break footage plus separately labelled earlier House rehearsal and 27 October accepted-result still.','Three capture attempts lost; no captured victory is claimed. Manual pauses are omitted with chronological editorial cuts.','The build chapter records actual GitHub source/commit review of a Codex-built patch. It is explicitly not Codex app footage. Architecture/asset graphics remain editorial explanations.','Game captures precede the subsequent pause/upload queue fix; source review shows the actual fixed commit.','No genuine viewer acceptance or runtime model calls.']}
    (dest.parent/f'MOTION_{mode.upper()}_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'file':str(dest),'bytes':dest.stat().st_size,'seconds':160,'audioIdentical':True}),flush=True)

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--mode',choices=['captioned','clean'],required=True)
    main(p.parse_args().mode)
