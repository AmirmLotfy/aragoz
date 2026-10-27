#!/usr/bin/env python3
"""Offline editorial assembly. Never opens a browser, audio device or provider API.

Use the bundled Python/Pillow and installed ffmpeg. Original captures stay in place.
The output is an explicitly labelled REVIEW CUT until owner VO + final footage arrive.
"""
from pathlib import Path
import argparse, hashlib, json, math, re, shutil, struct, subprocess, wave
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.runtime/submission-work'
OUT = ROOT / 'submission/video'
FONT = ROOT / 'apps/web/public/fonts/NotoSans.ttf'
MONO = Path('/System/Library/Fonts/Menlo.ttc')
MOV = ROOT / '.runtime/obs-recordings/2026-10-26 09-50-08.mov'
C = {'cream': '#F2E6CA', 'soot': '#24231F', 'red': '#C74632', 'blue': '#244A9A', 'gold': '#D5A43B'}
W, H, FPS, TOTAL = 1920, 1080, 30, 160

def font(size, bold=False, mono=False):
    f = ImageFont.truetype(str(MONO if mono else FONT), size)
    if bold and not mono:
        try: f.set_variation_by_name('Bold')
        except (ValueError, OSError): pass
    return f

def wrapped(draw, text, f, width):
    lines, current = [], ''
    for word in text.split():
        trial = (current + ' ' + word).strip()
        if draw.textlength(trial, font=f) > width and current:
            lines.append(current); current = word
        else: current = trial
    return lines + ([current] if current else [])

def block(draw, text, x, y, size, width, fill, bold=False, gap=1.35):
    f = font(size, bold)
    for line in wrapped(draw, text, f, width):
        draw.text((x, y), line, font=f, fill=fill); y += size * gap
    return y

def stamp(t):
    ms = round(t * 1000); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def card(name, kicker, title, lines, code=False):
    im = Image.new('RGB', (1416, 796), C['cream']); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 1416, 9), fill=C['red'])
    d.text((64, 45), kicker, font=font(23, True), fill=C['red'])
    y = block(d, title, 64, 100, 46, 1280, C['soot'], True) + 32
    for line in lines:
        if code:
            d.text((64, y), line, font=font(25, mono=True), fill=C['soot']); y += 42
        else:
            y = block(d, line, 64, y, 32, 1270, C['soot']) + 28
    path = WORK / (name + '.png'); im.save(path); return str(path.relative_to(ROOT))

def prepare(caption_overrides=None, voice_ready=False):
    WORK.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    assert MOV.exists(), 'Original owned OBS recording is required; never substitute generated gameplay.'
    records = []
    gallery = [
        ('01-real-twitch-vote.png', 'twitch-charge-vote-20261027.png', 'Real Twitch ballot: one operator vote, credited charge, labelled House alternatives.'),
        ('02-rule-activates.png', 'twitch-charge-activation-20261027.png', 'Real Twitch encounter activation, actual amirmolotfy credit and charge telegraph.'),
        ('03-counter-opens.png', 'twitch-charge-exposed-20261027.png', 'Actual stage-block counter opens the charge attachment.'),
        ('04-module-breaks.png', 'twitch-charge-broken-20261027.png', 'Actual author credit, broken attachment and disabled ability.'),
        ('05-credited-showbill.png', 'twitch-live-result-20261027.png', 'Accepted real operator result and immutable credited contracts; full-page screenshot.'),
    ]
    for dest, src, caption in gallery:
        source = ROOT / 'evidence' / src; target = ROOT / 'submission/screenshots' / dest
        shutil.copyfile(source, target)
        records.append({'file': str(target.relative_to(ROOT)), 'source': str(source.relative_to(ROOT)), 'caption': caption, 'sha256': sha(target), 'alteration': 'none; byte-identical copy', 'evidence': 'actual Twitch transport plus AI-operated account/play; not human/viewer acceptance'})
    proposal = card('proposal-transcript', 'RECORDED REAL TWITCH OPERATOR TEST / TRANSCRIPT', 'A boast with its own defeat.', [
        '“charges at you BUT cannot turn once it starts”',
        'Actual account: amirmolotfy · AI-operated for this test',
        'Matched contract: fast straight charge; blocks jam its axle.',
        'One real proposal and one real vote. No invented viewers.',
        'Source: evidence/twitch-real-operator-chain-20261027.json',
    ])
    code = card('combat-source', 'CODEX-ASSISTED BUILD / SOURCE + EDITORIAL NOTES', 'The break changes the rules.', [
        '// packages/combat/src/index.ts',
        'target.broken = true;',
        "this.emit('module-broken', target.recipe.slotId, 100);",
        '',
        '// Counters resolve before hazards in the same tick.',
        '// No I/O or wall clock drives CombatSimulation.step.',
        '',
        '171 unit/server tests + 28 full browser cases',
        'Historical source: 7fabb61; see validation receipts.',
    ], True)
    # Assert displayed executable source lines exist; comments are labelled editorial explanations.
    combat = (ROOT / 'packages/combat/src/index.ts').read_text()
    assert 'target.broken = true;' in combat and "this.emit('module-broken', target.recipe.slotId, 100);" in combat
    architecture = card('architecture', 'CODEX-ASSISTED BUILD / IMPLEMENTATION NOTES', 'One rule, across every layer.', [
        'Twitch chat  >  validated power + flaw  >  host review / vote',
        'Server-owned recipe  >  browser-owned 60 Hz combat',
        'Activation  >  exploit  >  physical break  >  credited result',
        'Typed contracts · Fastify / WebSockets · SQLite · Babylon.js',
        'Editorial architecture graphic; not a captured Codex interface.',
    ])
    assets = card('assets', 'ORIGINAL ART / SHIPPED LOCALLY', 'A miniature theatre, built to play.', [
        'Original Blender sources > validated GLB > actual Babylon stage',
        '1 hero · 1 stage · 2 shells · 3 mechanic families',
        '7 original GLBs · 44,796 whole-kit triangles',
        '1.35 MB gzip art · self-hosted licensed Noto fonts',
        'Generated concept / cover kept distinct from actual gameplay.',
    ])
    scenes = [
        (0,8,'01','The boast.','Real game. Real counterplay.','video',str(MOV.relative_to(ROOT)),10,[360,322,1196,674],'ACTUAL OBS / HOUSE REHEARSAL / AI-OPERATED'),
        (8,16,'01','ARAGOZ','Chat makes the monster. You find the loophole.','still','submission/artwork/aragoz-devpost-3x2.png',0,None,'PROMOTIONAL KEY ART / NOT GAMEPLAY'),
        (16,24,'02','Written in chat.','One explicit proposal. One supported power and flaw.','still',proposal,0,None,'REAL TWITCH OPERATOR TEST / EDITORIAL TRANSCRIPT'),
        (24,32,'02','Chosen in chat.','A real vote. The actual author. House choices labelled.','still','evidence/twitch-charge-vote-20261027.png',0,None,'REAL TWITCH TEST / ACTUAL STILL / 1 OPERATOR VOTE'),
        (32,38,'03','Now find the loophole.','Charge cannot turn. A block jams its axle.','still','evidence/twitch-charge-assembled-20261027.png',0,None,'REAL TWITCH ASSEMBLY / ACTUAL STILL'),
        (38,60,'03','Turn the rule against it.','Bait the charge. Use the block. Strike the opening.','video',str(MOV.relative_to(ROOT)),257,[360,322,1196,674],'ACTUAL OBS / SEPARATE HOUSE REHEARSAL / ORIGINAL SPEED'),
        (60,68,'04','Break the boast.','The attachment breaks. Its ability stops.','still','evidence/twitch-charge-broken-20261027.png',0,None,'REAL TWITCH ENCOUNTER / ACTUAL STILL'),
        (68,75,'04','Keep the credit.','The showbill preserves the author and the result.','still','evidence/twitch-live-result-20261027.png',0,[0,70,1280,820],'ACCEPTED TWITCH RESULT / ACTUAL STILL / AI-OPERATED'),
        (75,86,'05','Steam has a limit.','Wait out the bursts. Strike the overheated valve.','video',str(MOV.relative_to(ROOT)),238,[360,322,1196,674],'ACTUAL OBS / HOUSE REHEARSAL / ORIGINAL SPEED'),
        (86,97,'05','Make the copy fail.','Echo repeats a real movement trail. Blocks expose its mirror.','video',str(MOV.relative_to(ROOT)),897,[360,48,1196,674],'ACTUAL OBS / HOUSE REHEARSAL / ORIGINAL SPEED'),
        (97,105,'06','Three acts.','House Suggestions keep a quiet theatre playable.','still','evidence/browser/steps-1-5-regressions/house-choices.png',0,None,'ACTUAL LOCAL HOUSE UI / NO SYNTHETIC VIEWERS'),
        (105,112,'06','Encore. Or Remix.','Keep the recipe, or replace one module.','still','evidence/browser/readability-candidate/showbill-1280.png',0,None,'ACTUAL LOCAL SHOWBILL UI / PREPARED SAVE FIXTURE'),
        (112,125,'07','Built with Codex.','Code, assets, causal rules, and verification.','still',code,0,None,'EDITORIAL BUILD NOTES / REAL SOURCE / NOT CODEX SCREEN FOOTAGE'),
        (125,133,'07','Contracts carry the idea.','Separate responsive combat from network decisions.','still',architecture,0,None,'EDITORIAL ARCHITECTURE / IMPLEMENTED SYSTEMS'),
        (133,139,'07','Made for this stage.','Original assets, packaged with the game.','still',assets,0,None,'EDITORIAL ASSET NOTES / DOCUMENTED SHIPPED KIT'),
        (139,151,'08','Host stays in control.','6 authored profiles. Runtime model calls are off.','still','evidence/browser/readability-candidate/settings-1280.png',0,None,'ACTUAL SETTINGS UI / SUPPORTED CATALOGUE / TECHNICAL PREVIEW'),
        (151,160,'09','Whose idea backfired?','A playable theatre for chat and its performer.','still','submission/artwork/aragoz-devpost-3x2.png',0,None,'PROMOTIONAL KEY ART / TECHNICAL PREVIEW'),
    ]
    starts = [(0,8),(8,16),(16,32),(32,60),(60,75),(75,97),(97,112),(112,139),(139,151),(151,160)]
    raw = (ROOT / 'submission/VOICEOVER.md').read_text()
    texts = [re.search(r'\n\n([^#]+)', item).group(1).strip() for item in raw.split('## ')[1:11]]
    cues = []
    for (start,end), text in zip(starts,texts):
        words = text.split(); groups = [words[i:i+11] for i in range(0,len(words),11)]; consumed=0
        for group in groups:
            a=start+(end-start)*consumed/len(words); consumed+=len(group); b=start+(end-start)*consumed/len(words)
            cues.append({'start':round(a,3),'end':round(b,3),'text':' '.join(group)})
    if caption_overrides is not None: cues = caption_overrides
    (OUT / 'aragoz-review-en.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for i,c in enumerate(cues))+'\n')
    timeline=[]
    for i,(start,end,num,title,copy,kind,src,offset,crop,label) in enumerate(scenes):
        scene={'index':i,'start':start,'end':end,'chapter':num,'title':title,'copy':copy,'kind':kind,'source':src,'offset':offset,'crop':crop,'label':label}
        intervals=sorted(set([start,end]+[max(start,min(end,c[k])) for c in cues for k in ['start','end'] if start<c[k]<end]))
        playlist=[]
        for j,(a,b) in enumerate(zip(intervals,intervals[1:])):
            cue=next((c for c in cues if c['start'] <= (a+b)/2 < c['end']),None)
            im=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(im)
            d.rectangle((0,0,415,H),fill=C['cream']);d.rectangle((0,0,W,8),fill=C['red'])
            d.text((45,46),'ARAGOZ',font=font(35,True),fill=C['soot'])
            d.text((45,135),f'SCENE {num}',font=font(20,True),fill=C['red'])
            y=block(d,title,45,185,48,325,C['soot'],True)
            d.line((45,y+24,365,y+24),fill=C['soot'],width=2)
            block(d,copy,45,y+58,28,320,C['soot'])
            block(d,'TECHNICAL PREVIEW\nREVIEW CUT · VO ALIGNED' if voice_ready else 'TECHNICAL PREVIEW\nREVIEW CUT · VO PENDING',45,795,19,320,C['soot'])
            d.rectangle((416,0,W,99),fill=C['soot']);d.rectangle((416,896,W,H),fill=C['soot'])
            d.text((450,49),label,font=font(19,True),fill=C['cream'])
            if cue: block(d,cue['text'],455,925,32,1390,C['cream'],False,1.3)
            d.rectangle((0,1074,int(W*b/TOTAL),1079),fill=C['red'])
            dest=WORK/f'overlay-{i:02}-{j:02}.png';im.save(dest)
            playlist.extend([f"file '{dest}'",f'duration {b-a:.6f}'])
        playlist.append(f"file '{dest}'")
        path=WORK/f'overlays-{i:02}.ffconcat';path.write_text('\n'.join(playlist)+'\n');scene['overlayPlaylist']=str(path.relative_to(ROOT));timeline.append(scene)
    (OUT/'TIMELINE.json').write_text(json.dumps({'duration':TOTAL,'fps':FPS,'resolution':[W,H],'status':'voice-aligned-review-final-footage-pending' if voice_ready else 'review-cut-voice-and-final-footage-pending','scenes':timeline,'captions':cues},indent=2)+'\n')
    records.append({'file':str(MOV.relative_to(ROOT)),'sha256':sha(MOV),'evidence':'actual original M1 OBS; AI-led House rehearsal; source02f6b75','privateSource':True,'retention':'ignored local source, never copied or uploaded'})
    (ROOT/'submission/MEDIA_MANIFEST.json').write_text(json.dumps({'created':'2026-10-27','status':'unpublished-production-packet','gallery':records,'cover':{'file':'submission/artwork/aragoz-devpost-3x2.png','sha256':sha(ROOT/'submission/artwork/aragoz-devpost-3x2.png'),'kind':'generated promotional key art, never gameplay'},'limits':['No genuine human acceptance sessions.','Review cut uses actual Twitch stills plus separate OBS rehearsal motion.','Build notes are editorial; actual Codex UI capture remains pending.','Final footage, upload/access and submission approval remain pending. Voice integration is documented separately.']},indent=2)+'\n')
    print(json.dumps({'preparedScenes':len(timeline),'captionCues':len(cues),'voiceWords':sum(len(t.split()) for t in texts),'gallery':len(gallery)}),flush=True)

def run(args):
    r=subprocess.run(args,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if r.returncode: raise RuntimeError(r.stderr[-3500:])

def render(picture_only=False):
    j=json.loads((OUT/'TIMELINE.json').read_text()); parts=[]
    for s in j['scenes']:
        dest=WORK/f'scene-{s["index"]:02}.mp4'; parts.append(dest)
        args=['ffmpeg','-y','-hide_banner','-loglevel','error','-threads','2']
        if s['kind']=='video': args+=['-ss',str(s['offset']),'-i',str(ROOT/s['source'])]
        else: args+=['-loop','1','-framerate',str(FPS),'-i',str(ROOT/s['source'])]
        args+=['-f','concat','-safe','0','-i',str(ROOT/s['overlayPlaylist'])]
        crop=s['crop']; prefix=f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else ''
        filters=f'[0:v]{prefix}scale=1416:796:force_original_aspect_ratio=decrease,pad=1416:796:(ow-iw)/2:(oh-ih)/2:color={C["soot"]},setsar=1,pad=1920:1080:440:100:color={C["soot"]}[base];[base][1:v]overlay=0:0:eof_action=repeat:shortest=0,format=yuv420p[out]'
        args+=['-filter_complex_threads','1','-filter_complex',filters,'-map','[out]','-an','-t',str(s['end']-s['start']),'-r',str(FPS),'-c:v','libx264','-preset','veryfast','-crf','20','-threads','2','-movflags','+faststart',str(dest)]
        run(args); print(f'rendered {s["index"]+1}/{len(j["scenes"])}: {s["title"]}',flush=True)
    playlist=WORK/'scenes.ffconcat';playlist.write_text('\n'.join(f"file '{p}'" for p in parts)+'\n')
    clean=OUT/'aragoz-review-picture.mp4'
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(playlist),'-c','copy','-movflags','+faststart',str(clean)])
    if picture_only:
        print(json.dumps({'pictureOnly':str(clean.relative_to(ROOT)),'seconds':TOTAL}),flush=True)
        return clean
    bed=WORK/'original-editorial-bed.wav'; sr=48000; duration=TOTAL; data=bytearray(sr*duration*2)
    # Quiet original wood-like pulses; fixed authored sequence, no samples or output device.
    beats=[]
    for section in [0,8,16,24,32,60,68,75,86,97,105,112,125,133,139,151]:
        beats.extend([(section,155,0.045),(section+0.23,233,0.027),(section+0.53,310,0.022)])
    for t,f,amp in beats:
        for k in range(int(sr*0.16)):
            at=int(t*sr)+k
            if at>=sr*duration: break
            sec=k/sr; env=math.exp(-sec*38)*min(1,k/100)
            value=int(32767*amp*env*(math.sin(2*math.pi*f*sec)+0.28*math.sin(2*math.pi*f*2.31*sec)))
            old=struct.unpack_from('<h',data,at*2)[0];struct.pack_into('<h',data,at*2,max(-32768,min(32767,old+value)))
    with wave.open(str(bed),'wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(data)
    final=OUT/'aragoz-review-160s.mp4'
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(clean),'-i',str(bed),'-i',str(OUT/'aragoz-review-en.srt'),'-map','0:v:0','-map','1:a:0','-map','2:s:0','-c:v','copy','-c:a','aac','-b:a','128k','-ac','2','-c:s','mov_text','-metadata:s:s:0','language=eng','-metadata','title=ARAGOZ — review cut, voice pending','-t',str(TOTAL),'-movflags','+faststart',str(final)])
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_type,width,height,r_frame_rate,codec_name','-of','json',str(final)],text=True))
    assert float(probe['format']['duration']) < 180
    assert any(s.get('width')==1920 and s.get('height')==1080 for s in probe['streams'])
    (OUT/'RENDER_RECEIPT.json').write_text(json.dumps({'status':'local-review-cut-not-final-submission-video','file':str(final.relative_to(ROOT)),'sha256':sha(final),'media':probe,'voicePresent':False,'music':'original sparse offline editorial percussion; not captured game audio','browserActions':0,'paidCalls':0,'sources':'../MEDIA_MANIFEST.json','finalFootagePending':['continuous real Twitch video','actual Codex workflow capture'],'command':'bundled-python submission/source/build_video.py --prepare --render'},indent=2)+'\n')
    print(json.dumps({'rendered':str(final.relative_to(ROOT)),'bytes':final.stat().st_size,'duration':probe['format']['duration']}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--prepare',action='store_true');parser.add_argument('--render',action='store_true');args=parser.parse_args()
    if args.prepare: prepare()
    if args.render: render()
