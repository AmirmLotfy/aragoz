import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { Plane } from '@babylonjs/core/Maths/math.plane.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Scene } from '@babylonjs/core/scene.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Rendering/edgesRenderer.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Animations/animatable.js';
import '@babylonjs/loaders/glTF/2.0';
import { ARENA, AssetManifestSchema, MODULE_SOCKET_OFFSETS } from '@aragoz/contracts';
import type { AssetManifest, BossRecipe, FamilyId, SlotId, Vec2 } from '@aragoz/contracts';
import type { CombatSnapshot } from '@aragoz/combat';
import type { Preferences } from './settings';
import { localAssetReviewEnabled } from './asset-review';
import { AssetLoadBudget } from './asset-loading';

const C = { canvas: '#F2E6CA', soot: '#24231F', red: '#C74632', blue: '#244A9A', ochre: '#D5A43B', wood: '#88603E', darkwood: '#4B3427', brass: '#B08743' };
export interface StageMetrics { fps: number; triangles: number; drawCalls: number; geometry: string; }
interface Debris { node: TransformNode; started: number; origin: Vector3; }

export class Theatre {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FreeCamera;
  private instrumentation: SceneInstrumentation;
  private mats = new Map<string, StandardMaterial>();
  private staticGroups = new Map<string, Mesh[]>();
  private hero: TransformNode;
  private heroVisual: TransformNode;
  private boss: TransformNode;
  private bossVisual: TransformNode;
  private stageVisual: TransformNode;
  private heroArms: TransformNode[] = [];
  private heroLegs: TransformNode[] = [];
  private moduleNodes: Record<SlotId, TransformNode>;
  private moduleVisuals: Record<SlotId, TransformNode>;
  private moduleOriginals: Record<SlotId, TransformNode>;
  private broken = new Set<SlotId>();
  private debris: Debris[] = [];
  private lane: TransformNode;
  private cone: Mesh;
  private trail: Mesh;
  private trailPoints: Vector3[] = Array.from({ length: 180 }, () => Vector3.Zero());
  private steam: Mesh[] = [];
  private disposed = false;
  private assetLoadBudget: AssetLoadBudget | null = null;
  private approvedLoaded = 0;
  private candidateLoaded = 0;
  private activeAnimations: Array<{ stop: () => void }> = [];
  private heroAnimation: string | null = null;
  private heroGroups: import('@babylonjs/core').AnimationGroup[] = [];
  private moduleGroups: Partial<Record<SlotId, import('@babylonjs/core').AnimationGroup[]>> = {};
  private moduleAnimations: Partial<Record<SlotId, string|null>> = {};
  private hurtUntil=0;
  private heroShadow: Mesh;
  private bossShadow: Mesh;
  private coneAngle=1;
  private lastHeroPosition:Vec2|null=null;
  private lastHealth=5;
  private shakeUntil=0;
  private presentedFrames:number[]=[];

  constructor(private canvas: HTMLCanvasElement, private recipe: BossRecipe, preferences: Preferences) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance' });
    this.engine.setHardwareScalingLevel(preferences.quality === 'low' ? Math.max(1, window.devicePixelRatio) : Math.max(1, window.devicePixelRatio / 1.5));
    this.scene = new Scene(this.engine); this.scene.useRightHandedSystem = true;
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.scene.clearColor = Color4.FromHexString('#1E211FFF'); this.scene.ambientColor = Color3.FromHexString('#564B3E');
    this.camera = new FreeCamera('fixed-theatre-camera', new Vector3(0, 11, 15), this.scene);
    this.camera.setTarget(new Vector3(0, 2, -0.2)); this.camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA; this.camera.minZ = 0.1;
    const fill = new HemisphericLight('cloth-fill', new Vector3(0, 1, 0.2), this.scene); fill.intensity = 0.8; fill.groundColor = Color3.FromHexString('#5A4434');
    const key = new DirectionalLight('theatrical-key', new Vector3(-0.5, -1, -0.3), this.scene); key.intensity = 1.35; key.diffuse = Color3.FromHexString('#FFF0CF');
    this.stageVisual = new TransformNode('stage-visual', this.scene); this.buildStage();
    this.hero = new TransformNode('hero-position', this.scene); this.heroVisual = new TransformNode('hero-greybox', this.scene); this.heroVisual.parent = this.hero; this.buildHero();
    this.boss = new TransformNode('boss-position', this.scene); this.bossVisual = new TransformNode('boss-greybox', this.scene); this.bossVisual.parent = this.boss; this.buildBoss();
    this.moduleNodes = { left: new TransformNode('socket-left', this.scene), right: new TransformNode('socket-right', this.scene) };
    this.moduleOriginals = { left: new TransformNode('module-left-greybox', this.scene), right: new TransformNode('module-right-greybox', this.scene) };
    this.moduleVisuals = { ...this.moduleOriginals };
    for (const m of recipe.modules) {
      const offset=MODULE_SOCKET_OFFSETS[m.slotId];const socket = this.moduleNodes[m.slotId]; socket.parent = this.boss; socket.position.set(offset.x, 0, offset.z);
      this.moduleOriginals[m.slotId].parent = socket; this.buildModule(m.mechanicId, this.moduleOriginals[m.slotId]);
    }
    this.heroShadow = this.shadow('hero-shadow', 0.85); this.bossShadow = this.shadow('boss-shadow', 2.4);
    this.lane = new TransformNode('striped-charge-lane', this.scene);
    const laneWidth=(ARENA.bossRadius+ARENA.heroRadius)*2;
    const laneGround = this.box('charge-warning-ground', [laneWidth, 0.013, 1], C.red, [0, 0.025, 0.5], this.lane); laneGround.material = this.material('lane-translucent', C.red, 0.24);
    for (let i=0;i<8;i++) this.box('charge-warning-stripe', [laneWidth-0.05, 0.015, 0.025], i%2 ? C.soot : C.canvas, [0,0.037,(i+0.5)/8],this.lane);
    this.cone = this.makeCone();
    this.trail = MeshBuilder.CreateLines('echo-dotted-trail', { points: this.trailPoints, updatable: true }, this.scene); (this.trail as import('@babylonjs/core').LinesMesh).color = Color3.FromHexString(C.blue);
    for (let i=0;i<7;i++) { const puff=this.sphere('steam-puff', 0.5, C.canvas, [0,0,0]); puff.material=this.material('steam-soft',C.canvas,0.55); puff.setEnabled(false); this.steam.push(puff); }
    this.lane.setEnabled(false); this.cone.setEnabled(false); this.trail.setEnabled(false);
    this.resize();
  }
  private material(name: string, color: string, alpha=1): StandardMaterial {
    const existing=this.mats.get(name); if(existing)return existing;
    const mat=new StandardMaterial(name,this.scene); mat.diffuseColor=Color3.FromHexString(color); mat.specularColor=new Color3(0.03,0.03,0.03); mat.alpha=alpha;
    this.mats.set(name,mat); return mat;
  }
  private add<T extends Mesh>(mesh:T,color:string,pos:[number,number,number],parent?:TransformNode,stat=false):T {
    mesh.material=this.material(color,color); mesh.position.set(...pos); mesh.parent=parent??null; mesh.isPickable=false;
    if(stat){const list=this.staticGroups.get(color)??[];list.push(mesh);this.staticGroups.set(color,list);} return mesh;
  }
  private box(name:string,size:[number,number,number],color:string,pos:[number,number,number],parent?:TransformNode,stat=false):Mesh {
    return this.add(MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},this.scene),color,pos,parent,stat);
  }
  private sphere(name:string,diameter:number,color:string,pos:[number,number,number],parent?:TransformNode):Mesh {
    return this.add(MeshBuilder.CreateSphere(name,{diameter,segments:12},this.scene),color,pos,parent);
  }
  private cylinder(name:string,diameter:number,height:number,color:string,pos:[number,number,number],parent?:TransformNode,top?:number):Mesh {
    return this.add(MeshBuilder.CreateCylinder(name,{diameter,height,diameterTop:top??diameter,tessellation:16},this.scene),color,pos,parent);
  }
  private buildStage():void {
    const s=this.stageVisual;
    for(let i=0;i<16;i++)this.box('timber-plank-'+i,[0.87,0.18,8.5],['#A77C4C','#B38A58','#9C7046'][i%3],[i*0.88-6.6,-0.12,0],s,true);
    this.box('stage-front-rail',[14.5,0.5,0.25],C.darkwood,[0,-0.29,4.35],s,true);
    this.box('backcloth',[14.5,4.9,0.18],'#D8C6A0',[0,2.15,-4.5],s,true);
    this.box('backcloth-lower',[14.5,0.65,0.22],'#C5B38B',[0,0.25,-4.35],s,true);
    for(const side of [-1,1]){
      this.box('proscenium-post',[0.4,5.2,0.45],C.darkwood,[side*7.45,2.35,-3.8],s,true);
      this.box('curtain',[1.25,4.6,0.35],C.blue,[side*6.7,2.5,-4.05],s,true);
      for(let i=0;i<3;i++)this.box('curtain-fold',[0.16,4.5,0.24],'#1C3C7B',[side*(6.25+i*0.4),2.5,-3.82],s,true);
      this.box('curtain-tie',[1.3,0.12,0.5],C.ochre,[side*6.7,1.8,-3.8],s,true);
    }
    this.box('header',[15.3,0.56,0.4],C.darkwood,[0,5,-4],s,true);
    this.box('red-valance',[14.6,0.55,0.2],C.red,[0,4.65,-3.77],s,true);
    for(let i=0;i<10;i++){
      const diamond=this.box('painted-diamond',[0.2,0.2,0.04],C.ochre,[-6.3+i*1.4,4.68,-3.63],s,true);diamond.rotation.z=Math.PI/4;
    }
    for(const block of ARENA.blocks){
      this.box(block.id,[block.halfWidth*2,0.7,block.halfDepth*2],C.wood,[block.x,0.35,block.z],s,true);
      this.box(block.id+'-top',[1.35,0.08,1.35],C.canvas,[block.x,0.73,block.z],s,true);
      for(let i=0;i<4;i++)this.box('block-stripe',[0.13,0.02,1.31],C.soot,[block.x-0.48+i*0.3,0.78,block.z],s,true);
    }
    for(const [color,meshes] of this.staticGroups){
      if(meshes.length<2)continue;
      const merged=Mesh.MergeMeshes(meshes,true,true);if(merged){merged.name='stage-batch-'+color;merged.parent=s;merged.isPickable=false;}
    }
    this.staticGroups.clear();
  }
  private buildHero():void {
    const h=this.heroVisual;
    this.cylinder('hero-costume',0.56,0.56,C.canvas,[0,0.88,0],h,0.43);
    this.box('cobalt-sash',[0.6,0.13,0.42],C.blue,[0,0.63,0.03],h);
    this.sphere('hero-carved-head',0.49,'#BD8C58',[0,1.37,0],h);
    this.cylinder('red-cap',0.43,0.25,C.red,[0,1.69,0],h,0.33);
    this.sphere('hero-nose',0.13,'#BD8C58',[0,1.36,0.255],h);
    for(const side of [-1,1]){
      this.sphere('eye',0.07,C.soot,[side*0.1,1.44,0.215],h);
      const shoulder=new TransformNode('hero-shoulder',this.scene);shoulder.parent=h;shoulder.position.set(side*0.3,1.06,0);
      const sleeve=this.cylinder('sleeve',0.19,0.28,C.canvas,[side*0.08,-0.08,0],shoulder);sleeve.rotation.z=side*0.45;
      this.cylinder('wooden-arm',0.12,0.3,'#BD8C58',[side*0.13,-0.3,0],shoulder);
      this.sphere('broad-hand',0.2,'#BD8C58',[side*0.13,-0.48,0],shoulder);this.heroArms.push(shoulder);
      const hip=new TransformNode('hero-hip',this.scene);hip.parent=h;hip.position.set(side*0.15,0.58,0);
      this.cylinder('cloth-leg',0.22,0.32,C.canvas,[0,-0.15,0],hip);
      this.box('wooden-foot',[0.24,0.12,0.36],C.darkwood,[0,-0.39,0.07],hip);this.heroLegs.push(hip);
    }
    const baton=this.cylinder('stage-baton',0.07,0.7,C.wood,[0.13,-0.4,0.28],this.heroArms[1]);baton.rotation.x=Math.PI/2;
    this.box('cap-tassel',[0.05,0.25,0.05],C.soot,[0.19,1.65,0],h);
  }
  private buildBoss():void {
    const b=this.bossVisual;
    this.box('stage-frame',[1.6,0.3,1.1],C.darkwood,[0,0.34,0],b);
    if(this.recipe.bodyId==='teapot'){
      const belly=this.sphere('painted-kettle',1.7,C.red,[0,1.17,0],b);belly.scaling.y=0.83;
      this.cylinder('kettle-rim',1.62,0.12,C.brass,[0,1.65,0],b);
      this.cylinder('lid',1.24,0.25,C.brass,[0,1.92,0],b,0.55);
      this.sphere('lid-knob',0.2,C.ochre,[0,2.1,0],b);
      const spout=this.cylinder('spout',0.23,0.85,C.brass,[-0.72,1.55,0.03],b,0.33);spout.rotation.z=-1.1;
      const handle=MeshBuilder.CreateTorus('kettle-handle',{diameter:0.9,thickness:0.12,tessellation:20},this.scene);this.add(handle,C.brass,[0.85,1.3,-0.15],b);handle.rotation.z=Math.PI/2;
    }else{
      this.box('mirror-wood-frame',[1.8,1.7,0.52],C.wood,[0,1.25,0],b);
      this.box('matte-mirror',[1.5,1.4,0.08],'#829698',[0,1.25,0.3],b);
      this.cylinder('braggart-crown',1.5,0.3,C.blue,[0,2.2,0],b,1.15);
      this.sphere('brass-finial',0.22,C.ochre,[0,2.45,0],b);
    }
    for(const side of [-1,1]){
      this.sphere('boss-eye-white',0.24,C.canvas,[side*0.27,1.53,0.74],b);
      this.sphere('boss-eye',0.1,C.soot,[side*0.27,1.51,0.84],b);
      const brow=this.box('boss-brow',[0.34,0.09,0.07],C.soot,[side*0.27,1.68,0.78],b);brow.rotation.z=side*-0.23;
      this.box('wooden-leg',[0.18,0.3,0.23],C.wood,[side*0.5,0.15,0],b);
    }
    this.box('boast-mouth',[0.45,0.11,0.09],C.soot,[0,1.15,0.82],b);
  }
  private buildModule(family:FamilyId,parent:TransformNode):void {
    if(family==='charge'){
      const axle=this.cylinder('axle',0.1,0.85,C.brass,[0,0.4,0.15],parent);axle.rotation.z=Math.PI/2;
      for(const side of [-1,1]){const wheel=this.cylinder('charge-wheel',0.65,0.18,C.darkwood,[side*0.38,0.36,0.15],parent);wheel.rotation.z=Math.PI/2;this.sphere('hub',0.15,C.ochre,[side*0.5,0.36,0.15],parent);}
    }else if(family==='steam'){
      this.cylinder('steam-kettle',0.5,0.65,C.brass,[0,1.2,0.1],parent);
      this.cylinder('steam-neck',0.16,0.3,C.brass,[0,1.67,0.1],parent);
      const valve=MeshBuilder.CreateTorus('red-valve',{diameter:0.47,thickness:0.075,tessellation:16},this.scene);this.add(valve,C.red,[0,1.85,0.1],parent);
      this.box('valve-hub',[0.5,0.06,0.06],C.red,[0,1.85,0.1],parent);
    }else{
      this.box('mirror-module-frame',[0.68,0.94,0.12],C.ochre,[0,1.3,0.18],parent);
      this.box('mirror-module-face',[0.5,0.75,0.05],'#8AA1A5',[0,1.3,0.26],parent);
      const slash=this.box('mirror-gleam',[0.04,0.56,0.03],C.canvas,[0.06,1.3,0.3],parent);slash.rotation.z=-0.35;
    }
  }
  private shadow(name:string,diameter:number):Mesh {
    const m=MeshBuilder.CreateDisc(name,{radius:diameter/2,tessellation:24},this.scene);m.rotation.x=Math.PI/2;m.material=this.material('contact-shadow',C.soot,0.2);m.position.y=0.025;m.isPickable=false;return m;
  }
  private makeCone():Mesh {
    const mesh=new Mesh('striped-steam-cone',this.scene), data=new VertexData(),positions=[0,0,0],indices:number[]=[];
    const n=28;for(let i=0;i<=n;i++){const angle=-0.5+i/n;positions.push(Math.sin(angle),0,Math.cos(angle));if(i>0)indices.push(0,i,i+1);}
    data.positions=positions;data.indices=indices;data.normals=Array.from({length:positions.length/3},()=>[0,1,0]).flat();data.applyToMesh(mesh,true);
    const mat=this.material('cone-translucent',C.red,0.28);mat.backFaceCulling=false;mesh.material=mat;mesh.isPickable=false;mesh.enableEdgesRendering();mesh.edgesWidth=2;mesh.edgesColor=Color4.FromHexString('#24231FFF');return mesh;
  }
  async loadApprovedAssets():Promise<void> {
    const budget=new AssetLoadBudget();this.assetLoadBudget=budget;
    try {
      const reviewing=localAssetReviewEnabled();
      const response=await budget.wait(fetch(reviewing?'/__asset-review/manifest.json':'/assets/manifest.json',{signal:budget.signal}));if(!response.ok)return;
      const entries:AssetManifest[]=AssetManifestSchema.array().parse(await budget.wait(response.json()));
      if(this.disposed||budget.signal.aborted)return;
      const targets:Record<string,TransformNode>={hero:this.heroVisual,stage:this.stageVisual,['shell-'+this.recipe.bodyId]:this.bossVisual};
      for(const module of this.recipe.modules)targets['module-'+module.mechanicId]=this.moduleOriginals[module.slotId];
      await Promise.all(entries.filter(e=>e.acceptance===(reviewing?'pending-approval':'approved')&&e.revision===this.recipe.artKitVersion&&e.glbPath&&targets[e.id]).map(async entry=>{
        if(!entry.glbPath?.startsWith(reviewing?'/__asset-review/runtime/':'/assets/runtime/')||entry.glbPath.includes('..'))return;
        try {
          const container=await budget.wait(LoadAssetContainerAsync(entry.glbPath,this.scene),late=>late.dispose());if(this.disposed||budget.signal.aborted){container.dispose();return;}
          const old=targets[entry.id],parent=old.parent;
          const instance=container.instantiateModelsToScene(name=>entry.id+'-'+name,false);
          const replacement=new TransformNode(entry.id+'-approved',this.scene);replacement.parent=parent;
          for(const n of instance.rootNodes)n.parent=replacement;
          old.setEnabled(false);if(reviewing)this.candidateLoaded++;else this.approvedLoaded++;
          if(entry.id==='hero'){this.heroGroups=instance.animationGroups;this.heroVisual=replacement;}
          if(entry.id.startsWith('shell-')){this.bossVisual=replacement;const idle=instance.animationGroups.find(g=>g.name.endsWith('idle'));if(idle){idle.start(true);this.activeAnimations.push(idle);}}
          if(entry.id==='stage')this.stageVisual=replacement;
          const module=this.recipe.modules.find(m=>'module-'+m.mechanicId===entry.id);if(module){this.moduleVisuals[module.slotId]=replacement;this.moduleGroups[module.slotId]=instance.animationGroups;}
        }catch{/* The shipped geometry remains visible; loading failure never changes rules. */}
      }));
    }catch{/* Offline, absent or stalled assets keep the approved shipped fallback. */}
    finally{budget.close();if(this.assetLoadBudget===budget)this.assetLoadBudget=null;}
  }
  render(state:CombatSnapshot,wallTime:number,preferences:Preferences):void {
    const {hero,boss}=state;
    this.scene.animationTimeScale=state.paused&&!state.outcome?0:1;
    this.hero.position.set(hero.position.x,hero.dodging?0.12:0,hero.position.z);this.hero.rotation.y=Math.atan2(hero.facing.x,hero.facing.z);
    this.boss.position.set(boss.position.x,0,boss.position.z);this.boss.rotation.y=Math.atan2(boss.facing.x,boss.facing.z);
    const moving=this.lastHeroPosition!==null&&Math.hypot(hero.position.x-this.lastHeroPosition.x,hero.position.z-this.lastHeroPosition.z)>0.0001;
    const walk=moving?Math.sin(state.elapsed*13)*0.23:0;this.lastHeroPosition={...hero.position};
    if(hero.health<this.lastHealth){this.shakeUntil=state.elapsed+0.16;this.hurtUntil=state.elapsed+0.3;}this.lastHealth=hero.health;
    const shake=state.elapsed<this.shakeUntil&&!preferences.reducedMotion?Math.sin(state.elapsed*90)*preferences.shake*0.12:0;
    this.camera.position.x=shake;this.camera.setTarget(new Vector3(0,2,-0.2));
    for(let i=0;i<this.heroLegs.length;i++)this.heroLegs[i].rotation.x=hero.dodging?0.7:walk*(i===0?1:-1);
    for(let i=0;i<this.heroArms.length;i++)this.heroArms[i].rotation.x=hero.striking&&i===1?-1.4:walk*(i===0?-0.6:0.6);
    this.heroVisual.rotation.z=hero.dodging?-0.35:0;
    this.heroVisual.scaling.y=hero.health===0&&!this.heroGroups.length?0.25:1;
    const animation=hero.health===0?'defeat':state.outcome==='won'?'victory':state.elapsed<this.hurtUntil?'hurt':hero.dodging?'dodge':hero.striking?'strike':moving?'run':'idle';
    if((!state.paused||state.outcome||this.heroAnimation===null)&&animation!==this.heroAnimation&&this.heroGroups.length){this.heroGroups.forEach(g=>g.stop());this.heroGroups.find(g=>g.name.endsWith(animation))?.start(animation==='idle'||animation==='run'||animation==='victory');this.heroAnimation=animation;}
    this.heroShadow.position.x=hero.position.x;this.heroShadow.position.z=hero.position.z;
    this.bossShadow.position.x=boss.position.x;this.bossShadow.position.z=boss.position.z;
    this.bossVisual.rotation.z=preferences.reducedMotion?0:Math.sin(wallTime*2)*0.012;
    this.bossVisual.position.y=boss.stage==='exposed'?0.05:0;
    for(const m of state.modules){
      const clip=m.exposed?'exposed':boss.activeSlot===m.slotId&&['recording','windup'].includes(boss.stage)?'windup':null;
      if(!m.broken&&(!state.paused||this.moduleAnimations[m.slotId]===undefined)&&clip!==this.moduleAnimations[m.slotId]){
        const groups=this.moduleGroups[m.slotId]??[];groups.forEach(g=>g.stop().reset());
        if(clip)groups.find(g=>g.name.endsWith(clip))?.start(true);
        this.moduleAnimations[m.slotId]=clip;
      }
      if(m.broken&&!this.broken.has(m.slotId)){
        this.broken.add(m.slotId);
        const node=this.moduleVisuals[m.slotId];node.computeWorldMatrix(true);
        const scale=Vector3.One(),rotation=Quaternion.Identity(),origin=Vector3.Zero();node.getWorldMatrix().decompose(scale,rotation,origin);
        const fragment=new TransformNode('broken-'+m.slotId,this.scene);fragment.position.copyFrom(origin);
        const detached=node.clone('detached-'+m.slotId,fragment,false);
        if(detached){detached.position.setAll(0);detached.rotationQuaternion=rotation;detached.scaling.copyFrom(scale);detached.setEnabled(true);}
        this.debris.push({node:fragment,started:wallTime,origin});node.setEnabled(false);this.moduleNodes[m.slotId].setEnabled(false);
        this.moduleGroups[m.slotId]?.forEach(g=>g.stop());
      }
      if(!m.broken)this.moduleNodes[m.slotId].position.y=m.exposed?0.14:0;
    }
    this.debris=this.debris.filter(d=>{const age=wallTime-d.started;if(age>(preferences.reducedMotion?0.15:2)){d.node.dispose();return false;}if(!preferences.reducedMotion){d.node.position.set(d.origin.x+age*0.65,d.origin.y+Math.max(0,age*2-age*age*2),d.origin.z+age*0.7);d.node.rotation.z=age*3;}return true;});
    this.lane.setEnabled(false);this.cone.setEnabled(false);this.trail.setEnabled(false);this.steam.forEach(p=>p.setEnabled(false));
    const t=boss.telegraph;
    if(t){
      if(t.kind==='lane'){
        const start=t.points[0]??boss.position,end=t.points[1]??{x:start.x+t.direction.x*t.range,z:start.z+t.direction.z*t.range};
        this.lane.setEnabled(true);this.lane.position.set(start.x,0,start.z);this.lane.rotation.y=Math.atan2(t.direction.x,t.direction.z);this.lane.scaling.z=Math.hypot(end.x-start.x,end.z-start.z);
      }else if(t.kind==='cone'){
        if(this.coneAngle!==t.angle){const positions=[0,0,0];for(let i=0;i<=28;i++){const angle=(-0.5+i/28)*t.angle;positions.push(Math.sin(angle),0,Math.cos(angle));}this.cone.updateVerticesData(VertexBuffer.PositionKind,positions,true);this.coneAngle=t.angle;}
        this.cone.setEnabled(true);this.cone.position.set(boss.position.x,0.045,boss.position.z);this.cone.rotation.y=Math.atan2(t.direction.x,t.direction.z);this.cone.scaling.set(t.range,1,t.range);
        if(boss.damageActive)this.steam.forEach((p,i)=>{p.setEnabled(true);const distance=0.6+i*0.38;const side=(i%2?1:-1)*distance*t.angle*0.24;p.position.set(boss.position.x+t.direction.x*distance+t.direction.z*side,0.45+(i%3)*0.22,boss.position.z+t.direction.z*distance-t.direction.x*side);p.scaling.setAll(0.5+i*0.12);});
      }else if(t.points.length){
        this.trail.setEnabled(true);for(let i=0;i<this.trailPoints.length;i++){const p=t.points[Math.min(t.points.length-1,Math.floor(i/this.trailPoints.length*t.points.length))];this.trailPoints[i].set(p.x,0.07,p.z);}
        MeshBuilder.CreateLines('echo-dotted-trail',{points:this.trailPoints,instance:this.trail as import('@babylonjs/core').LinesMesh},this.scene);
      }
    }
    this.scene.render();
    const presented=performance.now();this.presentedFrames.push(presented);while(this.presentedFrames[0]<presented-1000)this.presentedFrames.shift();
  }
  pointerToWorld(clientX:number,clientY:number):Vec2|null {
    const r=this.canvas.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;
    const ray=this.scene.createPickingRay(x,y,null,this.camera),distance=ray.intersectsPlane(new Plane(0,1,0,0));
    if(distance===null)return null;const point=ray.origin.add(ray.direction.scale(distance));return{x:point.x,z:point.z};
  }
  resize():void {this.engine.resize();const aspect=this.engine.getRenderWidth()/Math.max(1,this.engine.getRenderHeight());const height=Math.max(5.2,8.4/aspect);this.camera.orthoTop=height;this.camera.orthoBottom=-height;this.camera.orthoLeft=-height*aspect;this.camera.orthoRight=height*aspect;}
  metrics():StageMetrics{return{fps:this.presentedFrames.length,triangles:this.scene.getActiveMeshes().data.reduce((n,m)=>n+(m?.isVisible?m.getTotalIndices()/3:0),0),drawCalls:this.instrumentation.drawCallsCounter.current,geometry:this.candidateLoaded?`${this.candidateLoaded} candidate assets · local review only`:this.approvedLoaded?`${this.approvedLoaded} approved assets loaded`:'Shipped fallback geometry · asset recovery'};}
  capturePreview():string|null {try{const c=document.createElement('canvas');c.width=480;c.height=270;const ctx=c.getContext('2d');if(!ctx)return null;ctx.drawImage(this.canvas,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.55);}catch{return null;}}
  dispose():void {this.disposed=true;this.assetLoadBudget?.close();this.activeAnimations.forEach(g=>g.stop());this.instrumentation.dispose();this.scene.dispose();this.engine.dispose();}
}
