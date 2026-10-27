#!/usr/bin/env python3
"""Build local review/source ZIPs from explicit source and media inventories.

Never publishes anything. Excludes ignored settings, databases, original voice,
transcripts and raw recordings. Source ZIP carries per-file identities/commit.
"""
from pathlib import Path
import hashlib, json, subprocess, zipfile

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'submission/local-review'

def cmd(*args):return subprocess.check_output(args,cwd=ROOT,text=True).strip()
def sha(data):return hashlib.sha256(data).hexdigest()

def source_paths():
    raw=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT)
    paths=sorted(set(x.decode() for x in raw.split(b'\0') if x))
    for name in paths:
        p=Path(name)
        assert not p.is_absolute() and '..' not in p.parts
        assert not any(x in {'.git','.runtime','data','node_modules','local-review'} for x in p.parts), name
        assert not (p.name.startswith('.env') and p.name!='.env.example'), name
        assert p.suffix.lower() not in {'.sqlite','.db','.pem','.p12','.key'}, name
        assert not (ROOT/p).is_symlink(), name
        assert (ROOT/p).resolve().is_relative_to(ROOT)
    return paths

def known_secrets():
    # Read only in memory for exclusion checking. Never copy/log settings or values.
    env=ROOT/'.env';values=[]
    if env.exists():
        for line in env.read_text().splitlines():
            if '=' not in line or line.lstrip().startswith('#'):continue
            key,value=line.split('=',1);value=value.strip().strip('"\'')
            if any(word in key.upper() for word in ['SECRET','API_KEY','ENCRYPTION_KEY']) and len(value)>=16:
                values.append(value.encode())
    return values

def main():
    OUT.mkdir(parents=True,exist_ok=True);paths=source_paths();private_values=known_secrets()
    head=cmd('git','rev-parse','HEAD');dirty=cmd('git','status','--porcelain')
    manifest=[];source_zip=OUT/'ARAGOZ-source-review.zip'
    with zipfile.ZipFile(source_zip,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name in paths:
            data=(ROOT/name).read_bytes()
            if any(secret in data for secret in private_values):raise RuntimeError('Private setting value found; archive stopped without disclosing value.')
            z.writestr('ARAGOZ-source/'+name,data);manifest.append({'path':name,'bytes':len(data),'sha256':sha(data)})
        snapshot={'kind':'source-identity-only-not-release-acceptance','head':head,'workingTreeDirty':bool(dirty),'dirtyPaths':dirty.splitlines(),'files':manifest,'excluded':['ignored settings/data/keys','original narration','raw recordings','browser profiles','dependency caches','voice-bearing exports'],'run':'Node24: npm ci --ignore-scripts; npm run build:release; npm start; open /house-show'}
        z.writestr('ARAGOZ-source/SOURCE_BUNDLE_MANIFEST.json',json.dumps(snapshot,indent=2)+'\n')
        z.writestr('ARAGOZ-source/BUNDLE_README.txt','ARAGOZ source snapshot\n\n'+snapshot['run']+'\n\nThe game can run House without credentials. Do not enable paid model calls. Read submission/JUDGE_GUIDE.md. This ZIP does not grant private GitHub judge access or prove contest acceptance. Promotional narration inputs/raw footage are private and excluded.\n')
    with zipfile.ZipFile(source_zip) as z:
        assert z.testzip() is None
        assert len(z.namelist())==len(manifest)+2
        for e in manifest:assert sha(z.read('ARAGOZ-source/'+e['path']))==e['sha256']
    review_files=[
        'submission/local-review/aragoz-narrated-review.mp4',
        'submission/local-review/aragoz-narrated-clean.mp4',
        'submission/local-review/aragoz-narrated-en.srt',
        'submission/artwork/aragoz-devpost-3x2.png',
        'submission/artwork/PROVENANCE.md',
        'submission/DEVPOST.md','devpost-submission.md','submission/JUDGE_GUIDE.md',
        'submission/YOUTUBE_UPLOAD.md','submission/FINAL_CAPTURE_PACKET.md','submission/DELIVERY.md',
        'submission/VOICE_INTEGRATION.md','submission/RESEARCH.md','submission/MEDIA_MANIFEST.json',
    ]+['submission/screenshots/'+name for name in [
        '01-real-twitch-vote.png','02-rule-activates.png','03-counter-opens.png','04-module-breaks.png','05-credited-showbill.png']]
    review_zip=OUT/'ARAGOZ-review-package.zip';review_manifest=[]
    with zipfile.ZipFile(review_zip,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name in review_files:
            p=ROOT/name;assert p.is_file(),name;data=p.read_bytes()
            dest='ARAGOZ-review/'+name.removeprefix('submission/').removeprefix('local-review/')
            z.writestr(dest,data);review_manifest.append({'file':dest,'sha256':sha(data),'bytes':len(data)})
        data=source_zip.read_bytes();dest='ARAGOZ-review/source/'+source_zip.name;z.writestr(dest,data);review_manifest.append({'file':dest,'sha256':sha(data),'bytes':len(data)})
        z.writestr('ARAGOZ-review/READ_ME_FIRST.txt','ARAGOZ — local review package\n\nWatch aragoz-narrated-review.mp4 (captions) or aragoz-narrated-clean.mp4 with aragoz-narrated-en.srt. Both have the same reviewed narration/mix. Cover and five actual screenshots are included. Copy and upload descriptions remain drafts. Source ZIP has the runnable game.\n\nStill pending: stronger Twitch/Codex workflow footage, authenticated Devpost form/eligibility/session/judge access, and final upload/entry approval. Do not treat this package as a submitted entry or an instruction to share private media. Original voice, credentials and raw recordings are not included.\n')
    with zipfile.ZipFile(review_zip) as z:
        assert z.testzip() is None
        for e in review_manifest:assert sha(z.read(e['file']))==e['sha256']
    receipt={'kind':'local-review-and-runnable-source-bundles','head':head,'workingTreeDirty':bool(dirty),'sourceFiles':len(manifest),'sourceBytes':sum(e['bytes'] for e in manifest),'sourceZip':{'file':source_zip.name,'bytes':source_zip.stat().st_size,'sha256':sha(source_zip.read_bytes())},'reviewZip':{'file':review_zip.name,'bytes':review_zip.stat().st_size,'sha256':sha(review_zip.read_bytes()),'files':review_manifest},'archiveCRCAndAllSourceHashesVerified':True,'forbiddenPrivatePathsExcluded':True,'configuredSecretValuesAbsent':True,'voiceOriginalExcluded':True,'uploaded':False,'limits':'Source/archive identity and local media delivery only; not provider/human/contest acceptance. Required private repository access still must be verified.'}
    (OUT/'DELIVERY_BUNDLE_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k!='reviewZip'}|{'reviewZip':{k:v for k,v in receipt['reviewZip'].items() if k!='files'}}),flush=True)

if __name__=='__main__':main()
