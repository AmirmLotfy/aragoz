"""ARAGOZ local kit v1. Original Python/Blender authored craft, no provider assets.
Run: blender --background --threads 2 --python scripts/blender/build_local_kit.py -- --export
Sources stay editable; an export copy is batched by rigid parent before GLB output.
Blender Z up, front -Y -> glTF Y up, front +Z exactly once.
"""
import bpy, math, json, os, sys, random, struct, zlib, hashlib
from mathutils import Vector
from pathlib import Path
from math import sin, cos, pi
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/source/local-kit-v1'; OUT=ROOT/'assets/candidates/runtime'; REVIEW=ROOT/'assets/candidates/review'
for d in (SRC,OUT,REVIEW): d.mkdir(parents=True,exist_ok=True)
SPEC=json.loads((ROOT/'assets/production/kit-spec.json').read_text())
SPECS={x['id']:x for x in SPEC['assets']}
random.seed(26026)
print('ARAGOZ_OWNED_PROCESS',os.getpid(),flush=True)
(ROOT/'assets/production/local-kit-process.json').write_text(json.dumps({'pid':os.getpid(),'state':'running','argv':sys.argv,'cwd':str(ROOT)})+'\n')
CURRENT=[]; MATS={}; REST={}; ACTIONS=[]

# Small, original tile textures. Quiet deterministic grain/weave, no external pixels.
def png_write(path, kind, size=256):
    raw=bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            if kind=='wood':
                g=0.91+0.045*sin(x*.29+sin(y*.024)*1.9)+.025*sin(x*.71+y*.007)
                g-=.06*(max(0,sin(x*.09+sin(y*.031)*2))**18)
            elif kind=='cloth':
                g=.94+.025*cos(x*pi)+.025*cos(y*pi)+.018*sin(x*.061+y*.029)
            else:
                g=.94+.025*sin(x*.079+y*.109)+.015*cos(x*.31-y*.27)
            v=max(0,min(255,round(g*255)));raw.extend((v,v,v,255))
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
    path.write_bytes(data)

for t in ('wood','cloth','paint'):
    p=SRC/(t+'-authored-256.png')
    png_write(p,t)

def lin(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgba(h): return tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5))+(1,)
PALETTE={'wood':'#AE8050','wood-dark':'#50392A','canvas':'#F2E6CA','red':'#C74632','blue':'#244A9A','brass':'#C49A51','soot':'#24231F','mirror':'#87A5AD','backdrop':'#DCC596'}
def material(key):
    if key in MATS:return MATS[key]
    m=bpy.data.materials.new(key); m.use_nodes=True; m.diffuse_color=rgba(PALETTE[key]);n=m.node_tree.nodes;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=rgba(PALETTE[key]);bs.inputs['Metallic'].default_value=.24 if key=='brass' else 0;bs.inputs['Roughness'].default_value=.72 if key=='brass' else .92
    kind='wood' if key in ('wood','wood-dark') else 'cloth' if key in ('canvas','red','blue','backdrop') else 'paint'
    # Core glTF: baked tile color multiplied by material factor is created offline.
    p=SRC/(key+'-color-256.png')
    # Tint the original gray tile in image pixels. Source files are explicit editable inputs.
    base=bpy.data.images.load(str(SRC/(kind+'-authored-256.png')),check_existing=True)
    image=bpy.data.images.new(key+'-authored-color',width=256,height=256,alpha=True)
    vals=list(base.pixels); tint=rgba(PALETTE[key])
    for i in range(0,len(vals),4):
        for axis in range(3): vals[i+axis]*=tint[axis]
    image.pixels=vals; image.filepath_raw=str(p);image.file_format='PNG';image.save();image.pack()
    tex=n.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear';m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);MATS[key]=m;return m

def reset(name):
    global CURRENT,REST,ACTIONS,MATS
    bpy.ops.wm.read_factory_settings(use_empty=True);CURRENT=[];REST={};ACTIONS=[];MATS={}
    sc=bpy.context.scene;sc.name=name;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1;sc.render.fps=30;sc.frame_start=0;sc.frame_end=60
    sc.world=bpy.data.worlds.new('warm-studio');sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.15,.11,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    return empty(name)

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;CURRENT.append(o);return o

def finish(o,name,mat,parent=None,bevel=0):
    o.name=name;o.data.name=name+'-mesh';o.parent=parent
    if mat:o.data.materials.append(material(mat))
    if bevel:
        mod=o.modifiers.new('hand-softened edges','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    CURRENT.append(o);return o

def box(name,loc,size,mat,parent=None,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,bevel)

def uvball(name,loc,size,mat,parent=None,seg=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)

def cyl(name,loc,radius,depth,mat,parent=None,axis='Z',r2=None,n=24):
    if r2 is None:bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=radius,depth=depth,location=loc)
    else:bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=radius,radius2=r2,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='X':o.rotation_euler[1]=pi/2
    if axis=='Y':o.rotation_euler[0]=pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return finish(o,name,mat,parent,0 if name=='deck-pegged-nail' else .006)

def tube(name,points,radius,mat,parent=None,n=8):
    # Polyline swept rings, deliberately modelled and exported as core triangles.
    verts=[];faces=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize();ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0));u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
        for j in range(n):verts.append(Vector(p)+radius*(u*cos(j*2*pi/n)+v*sin(j*2*pi/n)))
    for i in range(len(points)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend((tuple(reversed(range(n))),tuple((len(points)-1)*n+j for j in range(n))))
    return mesh(name,verts,faces,mat,parent,smooth=True)

def ring(name,loc,major,minor,mat,parent=None,axis='Z',n=32):
    bpy.ops.mesh.primitive_torus_add(major_segments=n,minor_segments=8,location=loc,major_radius=major,minor_radius=minor);o=bpy.context.object
    if axis=='Y':o.rotation_euler[0]=pi/2
    if axis=='X':o.rotation_euler[1]=pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)

def mesh(name,verts,faces,mat,parent=None,smooth=False):
    data=bpy.data.meshes.new(name+'-mesh');data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
    if smooth:
        for p in data.polygons:p.use_smooth=True
    finish(o,name,mat,parent)
    # Stable planar UVs for authored surfaces; density is deliberately quiet.
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        for li in p.loop_indices:
            v=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(v.x*.8+v.y*.13,v.z*.8+v.y*.21)
    return o

def lathe(name,profile,mat,parent=None,n=32,y_scale=1):
    verts=[];faces=[]
    for r,z in profile:
        for j in range(n):a=j*2*pi/n;verts.append((r*cos(a),r*sin(a)*y_scale,z))
    for i in range(len(profile)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend((tuple(reversed(range(n))),tuple((len(profile)-1)*n+j for j in range(n))))
    return mesh(name,verts,faces,mat,parent,True)

def diamond(name,center,w,h,mat,parent,front_y=None):
    x,y,z=center;return mesh(name,[(x-w/2,y,z),(x,y,z+h/2),(x+w/2,y,z),(x,y,z-h/2)],[(0,1,2,3)],mat,parent)

def bolts(parent,z,r,count=12,y_scale=1,mat='brass'):
    for i in range(count):
        a=i*2*pi/count;uvball('peened-rivet',(r*cos(a),r*sin(a)*y_scale,z),(.025,.025,.025),mat,parent,12,6)

def face(parent, z=1.4, y=-.25, scale=1, nose=True):
    # Inlaid whites, inset dark pupil, carved brows and curled moustache.
    for side in (-1,1):
        uvball('inlaid-eye',(side*.102*scale,y,z+.05*scale),(.073*scale,.028*scale,.061*scale),'canvas',parent,16,8)
        uvball('eye-pupil',(side*.091*scale,y-.026*scale,z+.045*scale),(.025*scale,.014*scale,.035*scale),'soot',parent,12,8)
        brow=tube('carved-eyebrow',[(side*.17*scale,y-.005,z+.115*scale),(side*.115*scale,y-.02,z+.138*scale),(side*.055*scale,y-.006,z+.115*scale)],.018*scale,'soot',parent)
        pts=[(side*t*scale,y-.025,z-.08*scale+(.12-t)*.15*scale) for t in (.02,.055,.10,.15,.19)]
        pts[-1]=(pts[-1][0],y-.02,z-.025*scale)
        tube('curled-moustache',pts,.022*scale,'soot',parent)
    if nose:uvball('carved-nose',(0,y-.065*scale,z-.015*scale),(.06*scale,.105*scale,.044*scale),'wood',parent,16,8)
    tube('smirk',[(-.075*scale,y-.012,z-.145*scale),(0,y-.03,z-.158*scale),(.07*scale,y-.012,z-.145*scale)],.012*scale,'soot',parent)

# Every clip is a separate named NLA track, merged across rigid nodes by the exporter.
def clip(name,node,keys):
    # keys: frame, local delta location, local Euler rotation. Rest parent transforms are retained.
    if node.name not in REST:REST[node.name]=(node.location.copy(),node.rotation_euler.copy(),node.scale.copy())
    loc,rot,scale=REST[node.name];node.animation_data_create();node.animation_data.action=None
    for frame,delta,angles in keys:
        node.location=loc+Vector(delta);node.rotation_euler=Vector(rot)+Vector(angles);node.scale=scale
        node.keyframe_insert(data_path='location',frame=frame);node.keyframe_insert(data_path='rotation_euler',frame=frame)
    action=node.animation_data.action;action.name=name+'--'+node.name
    track=node.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=max(k[0] for k in keys);strip.blend_type='REPLACE';strip.extrapolation='NOTHING';track.mute=True
    node.animation_data.action=None;node.location=loc;node.rotation_euler=rot;ACTIONS.append(action)

def hero():
    root=reset('hero');body=empty('performer-body',(0,0,.68),root)
    # Flared, stitched tunic with angular scalloped hems and puffy trousers.
    lathe('chalk-tunic',[(.25,-.01),(.245,.10),(.22,.29),(.205,.47)],'canvas',body,n=24,y_scale=.77)
    for side in (-1,1):
        hip=empty('hip-'+str(side),(side*.125,0,-.08),body)
        uvball('gathered-trouser',(0,.005,-.155),(.115,.12,.20),'canvas',hip,18,10)
        cyl('stitched-trouser-cuff',(0,0,-.31),.091,.045,'red',hip,n=18)
        cyl('ankle-peg',(0,0,-.36),.052,.06,'wood',hip,n=16)
        box('carved-slipper',(0,-.055,-.405),(.21,.34,.12),'wood',hip,.035)
        for seamx in (-.045,.025):tube('slipper-carving',[(seamx,-.205,-.37),(seamx,-.09,-.35),(seamx,.03,-.36)],.006,'wood-dark',hip,n=5)
    # Central costume placket, buttons, red sawtooth hem and quiet sewn edges.
    box('red-costume-placket',(0,-.167,.315),(.045,.012,.29),'red',body,.003)
    for z in (.22,.3,.38):uvball('wood-button',(.016,-.181,z),(.012,.009,.012),'wood-dark',body,10,6)
    for i in range(12):
        a=2*pi*i/12;b=2*pi*(i+1)/12;c=(a+b)/2
        mesh('red-hem-tooth',[(.252*cos(a),.195*sin(a),.008),(.253*cos(b),.195*sin(b),.008),(.256*cos(c),.199*sin(c),-.043)],[(0,1,2)],'red',body)
    for side in (-1,1):
        for z in (.05,.11,.17,.23,.29,.35,.41):
            tube('tunic-stitch',[(side*.188,-.093,z),(side*.201,-.082,z+.014)],.0038,'wood-dark',body,5)
    # Cloth wrap and hanging cobalt end, with doubled folded strips.
    lathe('cobalt-waist-wrap',[(.251,.005),(.254,.045),(.252,.10),(.245,.14)],'blue',body,n=24,y_scale=.80)
    for z in (.035,.07,.103):ring('sash-woven-fold',(0,0,z),.25,.008,'blue',body,n=24).scale.y=.80
    tail=box('sash-hanging-end',(.19,-.125,-.16),(.105,.035,.36),'blue',body,.012);tail.rotation_euler[1]=-.16
    for x in (.15,.18,.21,.24):tube('sash-fringe',[(x,-.14,-.32),(x-.015,-.14,-.37)],.005,'blue',body,n=5)
    # Jointed wooden arms with sleeve trim, palm cuts and a real baton grip pivot.
    shoulders=[]
    for side in (-1,1):
        shoulder=empty('shoulder-'+str(side),(side*.245,0,.35),body);shoulders.append(shoulder)
        cyl('wooden-shoulder-pin',(0,0,0),.075,.19,'wood',shoulder,'Y',n=16)
        sleeve=cyl('chalk-sleeve',(side*.025,0,-.07),.105,.18,'canvas',shoulder,n=20);sleeve.rotation_euler[1]=side*-.18
        cyl('red-sleeve-trim',(side*.04,0,-.15),.101,.035,'red',shoulder,n=20)
        arm=cyl('carved-forearm',(side*.048,0,-.265),.057,.20,'wood',shoulder,n=14);arm.rotation_euler[1]=side*-.08
        cyl('elbow-pin',(side*.047,0,-.17),.048,.13,'wood-dark',shoulder,'Y',n=14)
        hand=empty('hand-baton' if side==1 else 'open-hand',(side*.055,-.018,-.40),shoulder)
        uvball('broad-carved-palm',(0,0,0),(.102,.068,.125),'wood',hand,16,10)
        uvball('thumb',(-side*.088,-.021,.035),(.037,.048,.068),'wood',hand,12,8)
        for cut in (-.047,0,.047):tube('palm-finger-cut',[(cut,-.064,-.075),(cut,-.069,-.015)],.004,'wood-dark',hand,5)
        if side==1:
            baton=cyl('short-stage-baton',(0,-.085,.12),.034,.62,'wood-dark',hand,n=16)
            for zz in (-.17,.35):cyl('baton-brass-band',(0,-.085,zz),.036,.035,'brass',hand,n=16)
            cyl('baton-painted-band',(0,-.085,.29),.036,.045,'red',hand,n=16)
    head=empty('carved-head',(0,0,.69),body)
    uvball('carved-cheek-head',(0,0,0),(.225,.19,.25),'wood',head,24,16)
    # Sculpted jaw, ears, dark hair side locks; face points to -Y.
    uvball('jaw-plane',(0,-.025,-.12),(.18,.15,.12),'wood',head,20,10)
    for side in (-1,1):
        uvball('carved-ear',(side*.225,.005,0),(.053,.037,.08),'wood',head,14,8)
        uvball('ear-inset',(side*.241,-.023,.002),(.023,.014,.043),'wood-dark',head,12,6)
        box('painted-side-lock',(side*.194,-.01,.055),(.037,.16,.19),'soot',head,.012)
    face(head,z=.006,y=-.178,scale=1)
    # Faceted, slightly slouched red cap and actual hanging tassel.
    cap=lathe('red-felt-cap',[(.218,.14),(.222,.19),(.192,.345),(.12,.405),(.035,.39)],'red',head,n=20,y_scale=.85)
    ring('cap-stitched-edge',(0,0,.17),.218,.012,'wood-dark',head,n=28).scale.y=.85
    for i in range(14):
        a=2*pi*i/14;tube('cap-hand-stitch',[(.22*cos(a),.19*sin(a),.174),(.217*cos(a+.025),.188*sin(a+.025),.19)],.0035,'canvas',head,n=5)
    tube('tassel-cord',[(-.12,.025,.398),(-.23,.055,.32),(-.24,.06,.17)],.014,'soot',head)
    for i in range(6):tube('tassel-thread',[(-.24+(i-2.5)*.009,.061,.20),(-.25+(i-2.5)*.013,.07,.06)],.008,'soot',head,n=5)
    # Full clip set. Root stays fixed; floor placement remains simulation-owned.
    for name,amp,dur in [('idle',.014,60),('run',.035,24),('strike',.035,16),('dodge',-.10,20),('hurt',-.06,18),('victory',.09,60),('defeat',-.22,45)]:
        mid=dur//2
        rot=(0,.13 if name=='dodge' else 0,.15 if name=='hurt' else 0)
        if name=='defeat':rot=(.7,0,.2)
        clip(name,body,[(0,(0,0,0),(0,0,0)),(mid,(0,0,amp),rot),(dur,(0,0,amp if name=='defeat' else 0),rot if name=='defeat' else (0,0,0))])
        for i,shoulder in enumerate(shoulders):
            swing=(.8 if i==1 else -.4) if name=='strike' else (1.9 if name=='victory' else .6 if name=='run' else -.15)
            clip(name,shoulder,[(0,(0,0,0),(0,0,0)),(mid,(0,0,0),(swing if i==0 else -swing,0,0)),(dur,(0,0,0),(0,0,0))])
        for i,hip in enumerate([o for o in CURRENT if o.name.startswith('hip-')]):
            swing=(.5 if i==0 else -.5) if name=='run' else .04
            clip(name,hip,[(0,(0,0,0),(0,0,0)),(mid,(0,0,0),(swing,0,0)),(dur,(0,0,0),(0,0,0))])
    return root

def stage():
    root=reset('stage')
    # Seam-separated timber deck, visible endgrain and restrained plank fasteners.
    for i in range(18):
        x=-7.225+i*.85
        plank=box('deck-plank-%02d'%i,(x,0,-.105),(.842,8.7,.21),'wood',root,.014)
        for y in (-3.9,3.9):
            for xx in (x-.28,x+.28):cyl('deck-pegged-nail',(xx,y,.005),.018,.013,'wood-dark',root,n=6)
        for k in range(2):
            pts=[(x+(k-.5)*.30+.012*sin(j*.8+i),-4.1+j*.82,.003) for j in range(11)]
            tube('long-carved-wood-grain',pts,.0045,'wood-dark',root,n=4)
    box('front-fascia',(0,-4.23,-.10),(15.3,.24,.20),'wood-dark',root,.02)
    box('backdrop-canvas',(0,4.22,2.41),(14.8,.16,4.82),'backdrop',root,.01)
    # Hand-painted distant scenery as muted flat silhouettes; no iconographic shortcuts.
    for i in range(17):
        x=-6.75+i*.84;h=.45+.65*(.5+.5*sin(i*1.79));w=.65
        box('painted-distance-town',(x,4.122,h/2+.04),(w,.012,h),'wood',root,.002)
        if i%3==0:
            cyl('painted-distance-roof',(x,4.105,h+.17),w*.41,.35,'wood',root,n=12,r2=0)
    for side in (-1,1):
        box('timber-upright',(side*7.40,3.97,2.54),(.34,.42,5.08),'wood-dark',root,.035)
        box('upright-inset',(side*7.40,3.735,2.52),(.15,.03,4.8),'wood',root,.01)
        for z in (.2,1.8,3.5,4.95):box('forged-post-band',(side*7.4,3.97,z),(.39,.46,.10),'brass',root,.012)
        # Fluted cloth tapers toward tie, broad folds at top and foot.
        verts=[];faces=[];columns=16;rows=14
        for j in range(rows+1):
            z=.10+j*4.82/rows;tie=math.exp(-((z-1.9)/.82)**2);width=1.30-.48*tie;outer=7.20;inner=outer-width
            for k in range(columns+1):
                t=k/columns;x=side*(inner+width*t);y=3.68+.16*cos(t*6*pi)+.12*tie
                verts.append((x,y,z))
        for j in range(rows):
            for k in range(columns):a=j*(columns+1)+k;faces.append((a,a+1,a+columns+2,a+columns+1))
        mesh('gathered-cobalt-curtain',verts,faces,'blue',root,True)
        # Rope follows the tie and tassel hangs clear of play.
        tube('ochre-curtain-rope',[(side*6.15,3.58,1.9),(side*6.4,3.40,1.78),(side*6.75,3.40,1.81),(side*7.05,3.55,1.95)],.035,'brass',root,n=8)
        for k in range(5):tube('tie-tassel',[(side*(6.9+k*.018),3.48,1.84),(side*(6.91+k*.022),3.48,1.42)],.016,'brass',root,n=6)
    box('header-beam',(0,4.02,5.11),(15.3,.42,.38),'wood-dark',root,.03)
    box('header-brass-pinstripe',(0,3.79,5.03),(14.7,.025,.045),'brass',root,.008)
    # Overlapping scalloped red cloth valance, double edge and stitched accent.
    for i in range(11):
        x=-6.6+i*1.32;verts=[(x-.72,3.68,4.99),(x+.72,3.68,4.99)]
        for j in range(13):
            t=j/12;verts.append((x+.72-1.44*t,3.64+.04*sin(t*pi),4.79-.36*sin(t*pi)))
        mesh('red-scalloped-valance',verts,[tuple(range(len(verts)))],'red',root)
        tube('valance-ochre-piping',[(x+.71-1.42*j/12,3.613,4.79-.36*sin(j*pi/12)) for j in range(13)],.018,'brass',root,n=5)
        diamond('valance-painted-diamond',(x,3.60,4.68),.13,.18,'brass',root)
    # Exact1.3x1.3 blockers at simulation positions. Origin of named root is floor centre.
    for name,x,runtime_z in [('block-west',-3.1,-.2),('block-east',3.1,.9)]:
        p=empty(name,(x,-runtime_z,0),root)
        box('block-solid',(0,0,.35),(1.3,1.3,.7),'wood',p,.015)
        for side in (-1,1):
            box('block-corner-binding',(side*.58,-.658,.35),(.075,.018,.68),'wood-dark',p,.004)
            box('block-side-binding',(-.658,side*.58,.35),(.018,.075,.68),'wood-dark',p,.004)
        box('marked-block-top',(0,0,.708),(1.26,1.26,.016),'canvas',p,.006)
        for k in range(5):
            strip=box('block-warning-stripe',(-.48+k*.24,0,.722),(.11,1.20,.014),'wood-dark',p,.002)
        for y in (-.44,.02,.44):tube('block-wood-seam',[(-.62,y,.30),(-.62,y+.02,.62)],.007,'wood-dark',p,n=5)
    return root

def teapot():
    root=reset('shell-teapot');body=empty('kettle-body',(0,0,0),root)
    # Low wheeled profile is provided only by charge attachment. Shell uses timber feet.
    for side in (-1,1):
        box('wooden-foot',(side*.47,0,.12),(.22,.40,.24),'wood',body,.025)
    lathe('painted-kettle-belly',[(.48,.24),(.72,.35),(.84,.67),(.81,1.05),(.65,1.29),(.62,1.47)],'red',body,n=36,y_scale=.88)
    # Applied diamonds are authored paint plates; broad shapes readable at thumbnail size.
    for i in range(12):
        a=2*pi*i/12;center=Vector((.819*cos(a),.721*sin(a),.79));u=Vector((-sin(a),cos(a)*.88,0));v=Vector((0,0,.30));verts=[center-u*.15,center+v,center+u*.15,center-v]
        mesh('kettle-painted-diamond',verts,[(0,1,2,3)],'wood',body)
    for z,r in [(.36,.72),(1.12,.78),(1.37,.64),(1.49,.65)]:
        ring('rolled-brass-seam',(0,0,z),r,.045,'brass',body,n=36).scale.y=.88
    bolts(body,1.14,.788,14,.88)
    # Upper kettle head, red fluted lid and brass finial.
    lathe('brass-kettle-neck',[(.61,1.32),(.58,1.50),(.55,1.80),(.59,1.88)],'brass',body,n=32,y_scale=.92)
    lathe('red-kettle-lid',[(.61,1.87),(.62,1.92),(.56,2.04),(.35,2.13),(.10,2.15)],'red',body,n=28,y_scale=.92)
    ring('lid-lip',(0,0,1.89),.61,.035,'brass',body,n=32).scale.y=.92
    cyl('lid-button',(0,0,2.21),.072,.13,'brass',body,n=18);uvball('lid-finial',(0,0,2.285),(.08,.08,.025),'brass',body,16,8)
    for i in range(8):
        a=i*pi/4;tube('lid-pressed-rib',[(.57*cos(a),.52*sin(a),1.94),(.43*cos(a),.39*sin(a),2.08),(.15*cos(a),.14*sin(a),2.15)],.012,'brass',body,n=5)
    # Extruded trumpet spout, opening and handle, deliberately no spoon/staff.
    points=[(-.58,0,1.43),(-.83,0,1.55),(-1.02,0,1.77),(-1.15,0,1.88)]
    tube('curved-kettle-spout',points,.13,'brass',body,n=16)
    lip=ring('spout-mouth',(-1.17,0,1.90),.14,.025,'brass',body,axis='X',n=20);lip.rotation_euler[1]=-.65
    uvball('spout-dark-opening',(-1.185,-.005,1.913),(.028,.112,.104),'soot',body,16,8)
    tube('looped-kettle-handle',[(.54,.05,1.72),(.89,.05,1.92),(1.16,.05,1.73),(1.20,.05,1.34),(.93,.05,1.15),(.69,.05,1.27)],.065,'brass',body,n=10)
    # Face shell has canvas inlays plus a carved wooden nose.
    face(body,z=1.63,y=-.536,scale=1.8)
    for side in (-1,1):
        cyl('socket-rosette',(side*.74,-.06,1.10),.14,.065,'brass',body,axis='X',n=18)
        empty('left' if side==-1 else 'right',(side*1.05,-.2,0),root)
    # Blue fabric omitted from shell material budget; red skirt provides cloth silhouette.
    for side in (-1,1):
        box('lower-cloth-tab',(side*.22,-.58,.31),(.25,.04,.37),'canvas',body,.02)
        for k in range(3):tube('skirt-stitch',[(side*.22-.08+k*.08,-.606,.16),(side*.22-.08+k*.08,-.608,.44)],.005,'wood',body,n=5)
    clip('idle',body,[(0,(0,0,0),(0,0,-.01)),(30,(0,0,.025),(0,0,.01)),(60,(0,0,0),(0,0,-.01))])
    return root

def mirror_shell():
    root=reset('shell-mirror');body=empty('braggart-body',(0,0,0),root)
    for side in (-1,1):
        box('braggart-wood-foot',(side*.50,0,.14),(.25,.65,.28),'wood',body,.035)
        box('frame-side-post',(side*.78,.06,1.18),(.20,.40,1.90),'wood',body,.035)
        for z in (.42,1.97):ring('side-post-collar',(side*.78,.06,z),.115,.018,'brass',body,n=18)
    # Rounded portrait silhouette, double carved arch and restrained matte painted mirror.
    frame=uvball('oval-timber-frame',(0,.02,1.33),(.90,.24,1.02),'wood',body,32,20)
    faceplate=uvball('matte-blue-mirror',(0,-.215,1.34),(.71,.055,.83),'mirror',body,32,20)
    # Warm scallops around the oval give a carved cameo rather than generic glass rectangle.
    for i in range(20):
        a=i*2*pi/20;uvball('carved-frame-bead',(.80*cos(a),-.225,1.34+.92*sin(a)),(.045,.035,.055),'brass',body,10,6)
    # The mirror's expression is inlaid dark wood; negative cheek lines are light brass.
    for side in (-1,1):
        eye=uvball('mirror-narrow-eye',(side*.22,-.28,1.56),(.15,.018,.045),'soot',body,16,8);eye.rotation_euler[1]=side*.15
        tube('braggart-brow',[(side*.40,-.285,1.73),(side*.23,-.295,1.78),(side*.10,-.285,1.69)],.035,'soot',body,n=8)
        tube('mirror-moustache',[(side*.02,-.29,1.36),(side*.15,-.30,1.32),(side*.32,-.295,1.40)],.035,'soot',body,n=8)
    tube('mirror-smirk',[(-.25,-.29,1.18),(0,-.30,1.12),(.26,-.29,1.22)],.026,'soot',body,n=8)
    # Matte stylised glints only; there is no live reflection or external environment.
    tube('painted-mirror-glint',[(-.46,-.281,.98),(-.36,-.289,1.20)],.022,'brass',body,n=6)
    tube('painted-mirror-glint-short',[(-.34,-.286,.94),(-.27,-.294,1.10)],.012,'brass',body,n=5)
    lathe('cobalt-braggart-crown',[(.48,2.17),(.48,2.26),(.42,2.35),(.31,2.40)],'blue',body,n=24,y_scale=.77)
    for i in range(5):
        x=-.36+i*.18;mesh('crown-point',[(x-.08,-.20,2.34),(x+.08,-.20,2.34),(x,-.20,2.51)],[(0,1,2)],'brass',body)
    uvball('crown-centre-finial',(0,0,2.55),(.065,.065,.05),'brass',body,16,8)
    for side in (-1,1):
        empty('left' if side==-1 else 'right',(side*1.05,-.2,0),root)
        cyl('mirror-shell-socket',(side*.85,.06,.95),.12,.18,'brass',body,axis='X',n=18)
    # Back frame depth is authored too, keeping the same shell collision envelope.
    box('timber-rear-case',(0,.28,1.30),(1.25,.30,1.55),'wood',body,.03)
    clip('idle',body,[(0,(0,0,0),(0,0,-.012)),(30,(0,0,.02),(0,0,.012)),(60,(0,0,0),(0,0,-.012))])
    return root

def charge():
    root=reset('module-charge');axle=empty('axle',(0,0,.40),root)
    cyl('exposed-brass-axle',(0,0,0),.065,1.12,'brass',axle,axis='X',n=20)
    box('axle-bearing',(0,0,0),(.32,.27,.24),'brass',axle,.025)
    wheels=[]
    for side in (-1,1):
        w=empty('wheel-left' if side==-1 else 'wheel-right',(side*.47,0,0),axle);wheels.append(w)
        cyl('laminated-wood-wheel',(0,0,0),.38,.18,'wood-dark',w,axis='X',n=28)
        cyl('carved-wheel-face',(side*.095,0,0),.325,.018,'wood',w,axis='X',n=28)
        # Ring is vertical in YZ. Broad seams and eight pegged spokes read as constructed timber.
        ring('wheel-iron-binding',(side*.10,0,0),.347,.018,'brass',w,axis='X',n=28)
        cyl('brass-wheel-hub',(side*.12,0,0),.11,.12,'brass',w,axis='X',n=18)
        for j in range(8):
            a=j*pi/4;tube('wheel-board-seam',[(side*.108,.14*cos(a),.14*sin(a)),(side*.108,.30*cos(a),.30*sin(a))],.008,'wood-dark',w,n=5)
    for name in ('windup','exposed','break'):
        clip(name,axle,[(0,(0,0,0),(0,0,0)),(15,(0,0,.055 if name=='exposed' else 0),(0,.10 if name=='windup' else .25 if name=='break' else 0,0)),(30,(0,0,-.14 if name=='break' else 0),(0,.5 if name=='break' else 0,0))])
        for side,w in zip((-1,1),wheels):
            clip(name,w,[(0,(0,0,0),(0,0,0)),(15,(side*.06 if name=='break' else 0,0,0),(.6 if name=='windup' else .12,0,0)),(30,(side*.16 if name=='break' else 0,0,0),(1.2 if name=='windup' else .4 if name=='break' else 0,0,0))])
    return root

def steam():
    root=reset('module-steam');valve=empty('valve',(0,0,0),root)
    cyl('valve-wood-seat',(0,0,.13),.27,.26,'wood-dark',valve,n=20)
    lathe('brass-boiler-vessel',[(.21,.22),(.29,.32),(.29,.93),(.24,1.12),(.12,1.18),(.10,1.39)],'brass',valve,n=20)
    for z in (.36,.92):ring('boiler-rolled-seam',(0,0,z),.291,.018,'brass',valve,n=20)
    for i in range(8):
        a=i*pi/4;uvball('boiler-rivet',(.295*cos(a),.295*sin(a),.48),(.017,.017,.017),'brass',valve,10,6)
    lid=empty('valve-lid',(0,0,1.35),valve)
    cyl('lifting-lid',(0,0,0),.17,.06,'brass',lid,n=20)
    cyl('valve-spindle',(0,0,.22),.037,.42,'brass',lid,n=16)
    ring('red-valve-wheel',(0,0,.44),.235,.035,'red',lid,n=28)
    for a in (0,pi/2,pi,3*pi/2):tube('valve-wheel-spoke',[(0,0,.44),(.235*cos(a),.235*sin(a),.44)],.022,'red',lid,n=6)
    cyl('red-valve-hub',(0,0,.44),.065,.075,'red',lid,n=16)
    # Straight fitted outlet points along semantic front; steam remains runtime-owned.
    tube('boiler-front-outlet',[(0,-.17,1.02),(0,-.28,1.17),(0,-.28,1.32)],.065,'brass',valve,n=14)
    for name in ('windup','exposed','break'):
        clip(name,lid,[(0,(0,0,0),(0,0,0)),(15,(0,0,.10 if name=='exposed' else .025),(0,.25 if name=='break' else 0,.3 if name=='windup' else 0)),(30,(0,0,.18 if name=='exposed' else -.3 if name=='break' else 0),(0,.7 if name=='break' else 0,.6 if name=='windup' else 0))])
    return root

def echo():
    root=reset('module-echo');mirror=empty('mirror',(0,0,0),root)
    cyl('mirror-mount-foot',(0,0,.07),.18,.14,'wood-dark',mirror,n=20)
    cyl('mirror-support-stem',(0,0,.39),.055,.60,'brass',mirror,n=16)
    # Faceted oval with frame rosettes, hand-painted matte insert and an authored crack.
    uvball('mirror-framed-oval',(0,0,1.17),(.35,.15,.60),'brass',mirror,24,16)
    plate=empty('mirror-face',(0,-.145,1.17),mirror)
    uvball('matte-mirror-plate',(0,0,0),(.282,.028,.515),'mirror',plate,24,16)
    for a in (0,pi/2,pi,3*pi/2):uvball('frame-rosette',(.31*cos(a),-.132,1.17+.56*sin(a)),(.035,.025,.035),'brass',mirror,12,6)
    # Crack is subtle at rest, the break clip parts the frame/face together without shards/physics.
    tube('authored-mirror-crack',[(.12,-.033,.43),(.025,-.037,.15),(.095,-.038,-.03),(-.06,-.035,-.28)],.009,'wood-dark',plate,n=5)
    tube('mirror-painted-glint',[(-.17,-.032,-.12),(-.09,-.036,.16)],.018,'brass',plate,n=5)
    for name in ('windup','exposed','break'):
        clip(name,mirror,[(0,(0,0,0),(0,0,0)),(15,(0,0,0),(0,0,.06 if name=='windup' else 0)),(30,(0,0,-.08 if name=='break' else 0),(.7 if name=='break' else 0,0,-.06 if name=='windup' else 0))])
        clip(name,plate,[(0,(0,0,0),(0,0,0)),(15,(0,-.03 if name=='exposed' else 0,0),(0,0,0)),(30,(.11 if name=='break' else 0,-.06 if name=='exposed' else 0,0),(0,.3 if name=='break' else 0,0))])
    return root

BUILDERS={'hero':hero,'stage':stage,'shell-teapot':teapot,'shell-mirror':mirror_shell,'module-charge':charge,'module-steam':steam,'module-echo':echo}

def bounds(objects):
    pts=[];bpy.context.view_layer.update()
    for o in objects:
        if o.type=='MESH':pts.extend(o.matrix_world@Vector(v) for v in o.bound_box)
    return ([min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)])

def normalize(root,id):
    # Apply a single authored size correction to all local coordinates before animation creation is evaluated.
    # Source rotations are rest-axis aligned. All meshes/empties share the same world correction.
    lo,hi=bounds(CURRENT);expected=SPECS[id]['dimensions'];target=(expected[0],expected[2],expected[1]);scale=Vector([target[i]/(hi[i]-lo[i]) for i in range(3)])
    # Stage block geometry and simulation positions are exact; its authored bounds already meet contract.
    if id=='stage':return {'correction':[1,1,1],'sourceBounds':[lo,hi]}
    # Scaling the actor root is core TRS and does not require an engine-side correction.
    root.scale=scale;root.location.z=-lo[2]*scale[2]
    # Preserve centering in gameplay XZ while keeping semantic front (-Y).
    root.location.x=-(lo[0]+hi[0])*.5*scale[0];root.location.y=-(lo[1]+hi[1])*.5*scale[1]
    # Boss sockets retain exactly requested offsets independent of shell silhouette normalization.
    for o in CURRENT:
        if o.name in ('left','right'):
            side=-1 if o.name=='left' else 1
            o.location=Vector((side*1.05-root.location.x,-.2-root.location.y,-root.location.z))
            for axis in range(3):o.location[axis]/=scale[axis]
    return {'correction':list(scale),'sourceBounds':[lo,hi]}

def studio_camera(name,loc,target,scale,res=(960,720)):
    sc=bpy.context.scene;bpy.ops.object.camera_add(location=loc);cam=bpy.context.object;cam.name=name;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;sc.camera=cam
    sc.render.resolution_x=res[0];sc.render.resolution_y=res[1];sc.render.resolution_percentage=100
    # Warm broad key and neutral fill. Renderer is CPU-only and capped at two threads.
    for nm,l,e,size in [('large-warm-key',(-4,-6,8),950,5),('soft-front-fill',(5,-3,5),650,4),('rim-over-cloth',(0,5,7),1000,4)]:
        bpy.ops.object.light_add(type='AREA',location=l);o=bpy.context.object;o.name=nm;o.data.energy=e;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=24;sc.cycles.use_denoising=True;sc.render.threads_mode='FIXED';sc.render.threads=2;sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
    sc.view_settings.view_transform='AgX';return cam

def ground():
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));o=bpy.context.object;o.name='review-ground';o.data.materials.append(material('backdrop'));return o

def batch_export_copy(objects):
    # Collapse only static geometry sharing one rigid parent; retain all meaningful pivots/sockets.
    groups={}
    for o in objects:
        if o.type=='MESH' and not o.animation_data:groups.setdefault(o.parent,[]).append(o)
    for parent,items in groups.items():
        if len(items)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name=(parent.name if parent else 'kit')+'-crafted-surfaces'
    return [o for o in bpy.context.scene.objects if o.type in ('MESH','EMPTY') and o.name!='review-ground']

def build_export(id):
    root=BUILDERS[id]();normalization=normalize(root,id)
    asset_objects=list(CURRENT);bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
    sockets={o.name:[o.matrix_world.translation.x,o.matrix_world.translation.z,-o.matrix_world.translation.y] for o in CURRENT if o.name in SPECS[id]['requiredNodes']}
    # Authoring camera is outside runtime export selection, retained in .blend for review.
    scale=max(SPECS[id]['dimensions'])*1.65
    studio_camera('asset-orthographic-review',(3,-6,3.8),(0,0,SPECS[id]['dimensions'][1]*.48),scale,(720,720));ground()
    if id=='stage':studio_camera('production-theatre-orthographic',(0,-15,11),(0,.2,1),18.5,(1280,720))
    src=SRC/(id+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(src),compress=True)
    export_objects=batch_export_copy(asset_objects);bpy.ops.object.select_all(action='DESELECT')
    for o in export_objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_animations=True,export_animation_mode='NLA_TRACKS',export_merge_animation='NLA_TRACK',export_force_sampling=True,export_anim_slide_to_zero=True,export_optimize_animation_size=True,export_optimize_animation_keep_anim_object=True,export_cameras=False,export_lights=False,export_extras=False,export_draco_mesh_compression_enable=False,export_meshopt_compression_enable=False,export_use_gltfpack=False)
    tri=0
    for o in export_objects:
        if o.type=='MESH':o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
    return {'id':id,'source':str(src.relative_to(ROOT)),'candidate':str((OUT/(id+'.glb')).relative_to(ROOT)),'blenderMeshTriangles':tri,'normalization':normalization,'socketPositionsRuntime':sockets,'authorship':'Original Blender/Python authored geometry and256px tile textures, no provider generation or imported geometry','animationMode':'Rigid object TRS; NLA tracks named per contract','processId':os.getpid()}

def render_one(id):
    bpy.ops.wm.open_mainfile(filepath=str(SRC/(id+'.blend')));sc=bpy.context.scene;sc.render.filepath=str(REVIEW/(id+'-ortho.png'));bpy.ops.render.render(write_still=True)

# A faithful stage assembly uses exact same asset roots and the actual runtime camera.
def render_production():
    bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.world=bpy.data.worlds.new('theatre-world');sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.04,.032,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for id,pos in [('stage',(0,0,0)),('hero',(-1.8,-1.7,0)),('shell-teapot',(1.8,.8,0)),('module-charge',(.75,.6,0)),('module-steam',(2.85,.6,0))]:
        with bpy.data.libraries.load(str(SRC/(id+'.blend')),link=False) as (a,b):b.objects=[n for n in a.objects if n not in ['review-ground'] and not any(t in n for t in ['orthographic','key','fill','rim'])]
        imported=[]
        for o in b.objects:
            if o is not None and o.type in ('MESH','EMPTY'):
                bpy.context.collection.objects.link(o);imported.append(o)
        top=[o for o in imported if o.parent is None]
        for o in top:o.location+=Vector(pos)
    studio_camera('production-theatre-orthographic',(0,-15,11),(0,.2,1),18.5,(1280,720));sc.render.filepath=str(REVIEW/'production-theatre-orthographic.png');bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'production-review.blend'),compress=True);bpy.ops.render.render(write_still=True)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if '--export' in args:
    ids=args[args.index('--only')+1].split(',') if '--only' in args else list(BUILDERS)
    existing={}
    old_receipt=ROOT/'assets/production/local-kit-build-receipt.json'
    if old_receipt.exists():existing={r['id']:r for r in json.loads(old_receipt.read_text()).get('assets',[])}
    records=[]
    for id in ids:
        print('ARAGOZ_BUILD_START',id,flush=True);records.append(build_export(id));print('ARAGOZ_BUILD_END',id,flush=True)
    existing.update({r['id']:r for r in records});records=[existing[id] for id in BUILDERS if id in existing]
    (ROOT/'assets/production/local-kit-build-receipt.json').write_text(json.dumps({'status':'candidate-pending-review','blenderVersion':bpy.app.version_string,'pid':os.getpid(),'assets':records,'providerCalls':0,'paidCredits':0},indent=2)+'\n')
if '--render' in args:
    ids=args[args.index('--only')+1].split(',') if '--only' in args else list(BUILDERS)
    for id in ids:print('ARAGOZ_RENDER_START',id,flush=True);render_one(id);print('ARAGOZ_RENDER_END',id,flush=True)
    render_production()
if '--contact-sheet' in args:
    import numpy as np
    tile=720;w=2160;h=2160;canvas=np.ones((h,w,4),dtype=np.float32);canvas[:,:,:3]=(.76,.68,.53)
    labels=['hero','stage','shell-teapot','shell-mirror','module-charge','module-steam','module-echo']
    for index,id in enumerate(labels):
        im=bpy.data.images.load(str(REVIEW/(id+'-ortho.png')),check_existing=False)
        if im.size[0]!=tile or im.size[1]!=tile:im.scale(tile,round(im.size[1]*tile/im.size[0]))
        iw,ih=im.size;pix=np.array(im.pixels[:],dtype=np.float32).reshape(ih,iw,4)
        col=index%3;row=2-index//3;x=col*tile+(tile-iw)//2;y=row*tile+(tile-ih)//2;canvas[y:y+ih,x:x+iw]=pix
    im=bpy.data.images.new('local-kit-contact-sheet',width=w,height=h,alpha=True);im.pixels.foreach_set(canvas.ravel());im.filepath_raw=str(REVIEW/'local-kit-contact-sheet.png');im.file_format='PNG';im.save()
    print('ARAGOZ_CONTACT_SHEET',im.filepath_raw,flush=True)

(ROOT/'assets/production/local-kit-process.json').write_text(json.dumps({'pid':os.getpid(),'state':'completed','argv':sys.argv,'cwd':str(ROOT)})+'\n')
