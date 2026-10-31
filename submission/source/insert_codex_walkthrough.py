#!/usr/bin/env python3
"""Insert the owner's actual Codex walkthrough into the existing 160s demo.

Offline only. Preserves the original files and AAC packets; no capture, provider,
speaker playback, generated footage, or account access. Requires Pillow/FFmpeg.
"""
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.runtime/codex-video-revision-20261031'
OUT = ROOT / 'submission/local-review'
CLIP = ROOT / 'docs/media/aragoz-codex-planning.mp4'
SRT = OUT / 'aragoz-narrated-motion-en.srt'
FONT = ROOT / 'apps/web/public/fonts/NotoSans.ttf'
START, END, TOTAL, FPS = 112, 133, 160, 30
EXPECTED = {
    'docs/media/aragoz-codex-planning.mp4': '3b4e83c6e310287716075c4df45e7623757be39776e0a31f0c727c24ef5f044d',
    'submission/local-review/aragoz-narrated-motion-review.mp4': '03b43c4ed88d61207f0303ca9fe86bac638a1c7bde9a007d4307fdc1ac5d8ccc',
    'submission/local-review/aragoz-narrated-motion-clean.mp4': 'a5aa9e0a47472ef014149cbfc03c4e286a0fa21fc0708b9ca2205231499e5a2a',
}


def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-3500:])
    return result.stdout


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def audio_hash(path):
    return run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).strip()


def seconds(text):
    hour, minute, second = text.split(':')
    return int(hour) * 3600 + int(minute) * 60 + float(second.replace(',', '.'))


def cues():
    result = []
    for block in SRT.read_text().strip().split('\n\n'):
        rows = block.splitlines()
        start, end = rows[1].split(' --> ')
        result.append((seconds(start), seconds(end), ' '.join(rows[2:])))
    assert len(result) == 33
    return result


def overlays(mode):
    captions = cues() if mode == 'captioned' else []
    points = sorted({START, END} | {t for a, b, _ in captions for t in (a, b) if START < t < END})
    directory = WORK / mode
    directory.mkdir(parents=True, exist_ok=True)
    listing = []
    title_font = ImageFont.truetype(str(FONT), 28)
    caption_font = ImageFont.truetype(str(FONT), 32)
    note_font = ImageFont.truetype(str(FONT), 18)
    for i, (a, b) in enumerate(zip(points, points[1:])):
        picture = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
        draw = ImageDraw.Draw(picture)
        draw.rectangle((0, 0, 1919, 81), fill='#24231F')
        draw.rectangle((0, 0, 1919, 6), fill='#C74632')
        draw.text((96, 25), 'BUILT WITH CODEX  /  ACTUAL PROJECT THREAD', font=title_font, fill='#F2E6CA')
        draw.rectangle((0, 916, 1919, 1079), fill='#24231F')
        text = next((text for start, end, text in captions if start <= (a+b)/2 < end), '')
        lines, current = [], ''
        for word in text.split():
            trial = (current + ' ' + word).strip()
            if current and draw.textlength(trial, font=caption_font) > 1680:
                lines.append(current)
                current = word
            else:
                current = trial
        if current:
            lines.append(current)
        assert len(lines) <= 2
        for j, line in enumerate(lines):
            x = (1920 - draw.textlength(line, font=caption_font)) / 2
            draw.text((x, 935 + j * 44), line, font=caption_font, fill='#F2E6CA')
        note = 'Owner-recorded walkthrough, 28 Oct 2026 · retrospective navigation · original speed'
        x = (1920 - draw.textlength(note, font=note_font)) / 2
        draw.text((x, 1044), note, font=note_font, fill='#F2E6CA')
        target = directory / f'overlay-{i:02}.png'
        picture.save(target)
        listing.extend([f"file '{target}'", f'duration {b-a:.9f}'])
    listing.append(f"file '{target}'")
    playlist = directory / 'overlays.ffconcat'
    playlist.write_text('\n'.join(listing) + '\n')
    return playlist


def render(mode):
    source = OUT / ('aragoz-narrated-motion-review.mp4' if mode == 'captioned' else 'aragoz-narrated-motion-clean.mp4')
    destination = OUT / f'aragoz-codex-walkthrough-{mode}-20261031.mp4'
    partial = destination.with_suffix('.partial.mp4')
    assert not destination.exists() and not partial.exists(), 'Refusing to overwrite a prior export.'
    playlist = overlays(mode)
    chapter = WORK / mode / 'chapter.mp4'
    assert not chapter.exists(), 'Refusing to replace an existing chapter render.'
    filters = (
        '[0:v]trim=duration=21,setpts=PTS-STARTPTS,fps=30,'
        'scale=1728:1080,pad=1920:1080:96:0:color=0x24231F,setsar=1[screen];'
        '[1:v]fps=30,trim=duration=21,setpts=PTS-STARTPTS[labels];'
        '[screen][labels]overlay=0:0:shortest=1,format=yuv420p[out]'
    )
    print(f'Rendering {mode}: replace only 01:52–02:13; preserve the 160s timeline and audio.', flush=True)
    run(['ffmpeg', '-n', '-hide_banner', '-loglevel', 'error', '-threads', '2',
         '-i', str(CLIP), '-f', 'concat', '-safe', '0', '-i', str(playlist),
         '-filter_complex_threads', '1', '-filter_complex', filters,
         '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
         '-threads', '2', '-r', str(FPS), '-frames:v', '630',
         '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709',
         '-color_trc', 'bt709', str(chapter)])
    # The old edit has exact scene keyframes at112/133. Copy those original video
    # packets directly instead of compositing/re-encoding the surrounding demo.
    keyframes = run(['ffprobe', '-v', 'error', '-skip_frame', 'nokey', '-select_streams', 'v:0',
                     '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', str(source)])
    times = {round(float(line.strip().rstrip(',')), 6) for line in keyframes.splitlines() if line.strip().rstrip(',')}
    assert {112.0, 133.0}.issubset(times), 'Stream-copy edit boundaries are not exact keyframes.'
    prefix, suffix = WORK / mode / 'prefix.mp4', WORK / mode / 'suffix.mp4'
    run(['ffmpeg', '-n', '-v', 'error', '-i', str(source), '-map', '0:v:0', '-an',
         '-frames:v', '3360', '-c:v', 'copy', str(prefix)])
    run(['ffmpeg', '-n', '-v', 'error', '-ss', '133', '-i', str(source), '-map', '0:v:0', '-an',
         '-frames:v', '810', '-c:v', 'copy', str(suffix)])
    for path, duration, count in ((prefix, 112, '3360'), (chapter, 21, '630'), (suffix, 27, '810')):
        part = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                              '-show_entries', 'stream=duration,nb_frames', '-of', 'json', str(path)]))['streams'][0]
        assert float(part['duration']) == duration and part['nb_frames'] == count
    sequence = WORK / mode / 'scenes.ffconcat'
    sequence.write_text('\n'.join(f"file '{path}'" for path in (prefix, chapter, suffix)) + '\n')
    run(['ffmpeg', '-n', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
         '-i', str(sequence), '-i', str(source), '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy',
         '-map_metadata', '-1', '-metadata', 'title=ARAGOZ — Twitch demo and actual Codex walkthrough',
         '-movflags', '+faststart', str(partial)])
    media = json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
                           'format=duration,size:stream=codec_type,codec_name,width,height,nb_frames,r_frame_rate',
                           '-of', 'json', str(partial)]))
    assert float(media['format']['duration']) == TOTAL
    video = next(stream for stream in media['streams'] if stream['codec_type'] == 'video')
    assert (video['width'], video['height'], video['nb_frames'], video['r_frame_rate']) == (1920, 1080, '4800', '30/1')
    before_audio = audio_hash(source)
    assert audio_hash(partial) == before_audio, 'Original AAC packets changed.'
    decoded = run(['ffmpeg', '-hide_banner', '-v', 'error', '-xerror', '-i', str(partial),
                   '-progress', 'pipe:1', '-f', 'null', '-'])
    frames = [int(line.split('=')[1]) for line in decoded.splitlines() if line.startswith('frame=')]
    assert frames[-1] == TOTAL * FPS
    # A concrete encoded-pixel guard catches dropped header/footer overlays.
    sample = WORK / mode / 'encoded-label-check.png'
    run(['ffmpeg', '-hide_banner', '-v', 'error', '-ss', '112.5', '-i', str(partial),
         '-frames:v', '1', '-y', str(sample)])
    with Image.open(sample) as image:
        red, green, blue = image.convert('RGB').getpixel((32, 3))
        assert red > 140 and green < 110 and blue < 100, 'Chapter header did not survive assembly.'
        red, green, blue = image.convert('RGB').getpixel((32, 1000))
        assert max(red, green, blue) < 70, 'Chapter footer did not survive assembly.'
    partial.rename(destination)
    print(f'Passed {mode}: complete decode, 4800 frames, original AAC packet hash.', flush=True)
    return {'file': str(destination.relative_to(ROOT)), 'sha256': sha(destination), 'media': media,
            'originalAudioPacketHash': before_audio, 'audioPacketsUnchanged': True,
            'fullDecodeNoErrors': True, 'decodedVideoFrames': frames[-1], 'uploaded': False}


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    receipt_path = OUT / 'CODEX_WALKTHROUGH_REVISION_20261031.json'
    assert not receipt_path.exists(), 'Refusing to replace the prior receipt.'
    for relative, expected in EXPECTED.items():
        assert sha(ROOT / relative) == expected, f'Input identity changed: {relative}'
    result = {'date': '2026-10-31', 'kind': 'offline-video-revision-with-owner-recorded-Codex-UI',
              'sources': EXPECTED, 'changedIntervalSeconds': [START, END], 'seconds': TOTAL,
              'clipIntervalSeconds': [0, 21], 'playbackSpeed': 1,
              'visualTreatment': 'Full frame aspect ratio preserved at 1728x1080 inside1920x1080. Header/footer labels and narration captions overlay the recording. Surrounding original video packets are copied at verified scene keyframes, without re-encoding.',
              'limits': ['Retrospective project-thread navigation supplied by the owner, not live coding.',
                         'Existing Twitch, House, result and game evidence retain their original labels and source dates.',
                         'No new Twitch/provider/human acceptance or generated footage.',
                         'Local exports only; no upload, submission or replacement of the original public movie.'],
              'exports': []}
    for mode in ('captioned', 'clean'):
        result['exports'].append(render(mode))
        receipt_path.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'receipt': str(receipt_path.relative_to(ROOT)), 'exports': len(result['exports'])}), flush=True)


if __name__ == '__main__':
    main()
