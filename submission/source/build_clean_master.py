#!/usr/bin/env python3
"""Caption-free review picture with the exact already-reviewed AAC audio.

Original game UI, source labels and review designation remain visible. This
removes only editorial narration captions. No new voice processing or network.
"""
from pathlib import Path
import hashlib, importlib.util, json, subprocess

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.runtime/submission-clean'
SOURCE=ROOT/'submission/local-review/aragoz-narrated-review.mp4'
DEST=ROOT/'submission/local-review/aragoz-narrated-clean.mp4'

def run(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-3000:])
    return p.stdout

def audio_hash(path):
    return run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).strip()

def main():
    assert SOURCE.is_file()
    before=audio_hash(SOURCE)
    spec=importlib.util.spec_from_file_location('picture',ROOT/'submission/source/build_video.py')
    picture=importlib.util.module_from_spec(spec);spec.loader.exec_module(picture)
    picture.OUT=OUT;picture.WORK=OUT/'work'
    picture.prepare(caption_overrides=[],voice_ready=True)
    clean=picture.render(picture_only=True)
    run(['ffmpeg','-y','-v','error','-i',str(clean),'-i',str(SOURCE),'-map','0:v:0','-map','1:a:0','-c','copy','-metadata','title=ARAGOZ — clean narrated review','-movflags','+faststart',str(DEST)])
    after=audio_hash(DEST);assert before==after,'The reviewed AAC audio must remain byte-identical.'
    run(['ffmpeg','-v','error','-i',str(DEST),'-f','null','-'])
    probe=json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','format=duration,size:stream=codec_type,width,height,nb_read_frames,r_frame_rate','-of','json',str(DEST)]))
    assert float(probe['format']['duration'])==160 and probe['streams'][0]['nb_read_frames']=='4800'
    receipt={'kind':'local-caption-free-narrated-review','file':str(DEST.relative_to(ROOT)),'sha256':hashlib.sha256(DEST.read_bytes()).hexdigest(),'media':probe,'audioStreamIdenticalToCaptioned':True,'audioPacketHash':after,'captions':'aragoz-narrated-en.srt','fullDecodeNoErrors':True,'limits':'Review designation/source labels retained. Provisional Twitch stills and editorial Codex notes remain. No upload or contest acceptance.'}
    (DEST.parent/'CLEAN_MASTER_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'cleanMaster':str(DEST),'audioIdentical':True,'seconds':160,'bytes':DEST.stat().st_size}),flush=True)

if __name__=='__main__':main()
