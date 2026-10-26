export interface GlbPolicy { maxTriangles?:number; maxTextureDimension?:number; expectedDimensions?:[number,number,number]; dimensionTolerance?:number; }
export interface GlbInspection {
  sha256:string;byteLength:number;triangles:number;sceneTriangles:number;primitiveCount:number;materialCount:number;
  dimensions:[number,number,number];bounds:{min:[number,number,number];max:[number,number,number]};
  nodeNames:string[];animationNames:string[];textures:{mimeType:string;width:number;height:number;bytes:number}[];
}
export function inspectGlb(bytes:Uint8Array,policy?:GlbPolicy):GlbInspection;
