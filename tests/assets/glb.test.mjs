import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { inspectGlb } from '../../scripts/lib/glb.mjs';

// Small, authored, in-memory fixtures. No files, engine, provider, or network.
function fixture({ positions = [0, 0, 0, 1, 0, 0, 0, 1, 0], indices = [0, 1, 2], stride = 12 } = {}) {
  const doc = {
    asset: { version: '2.0' }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: 'paint', pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1 } }],
    nodes: [{ name: 'triangle', mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
  const chunks = [];
  let length = 0;
  function append(bytes, options = {}) {
    const padding = (4 - length % 4) % 4;
    if (padding) chunks.push(Buffer.alloc(padding));
    length += padding;
    const view = doc.bufferViews.length;
    doc.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, ...options });
    chunks.push(bytes);
    length += bytes.length;
    return view;
  }
  function accessor(values, type, componentType = 5126) {
    const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const size = componentType === 5123 ? 2 : 4;
    const data = Buffer.alloc(values.length * size);
    values.forEach((value, i) => componentType === 5123 ? data.writeUInt16LE(value, i * size) : data.writeFloatLE(value, i * size));
    const index = doc.accessors.length;
    doc.accessors.push({ bufferView: append(data), componentType, type, count: values.length / widths[type] });
    return index;
  }
  const vertexData = Buffer.alloc(positions.length / 3 * stride);
  positions.forEach((value, i) => vertexData.writeFloatLE(value, Math.floor(i / 3) * stride + i % 3 * 4));
  doc.accessors.push({ bufferView: append(vertexData, { target: 34962, ...(stride === 12 ? {} : { byteStride: stride }) }), componentType: 5126, type: 'VEC3', count: positions.length / 3 });
  const indexData = Buffer.alloc(indices.length * 2);
  indices.forEach((value, i) => indexData.writeUInt16LE(value, i * 2));
  doc.accessors.push({ bufferView: append(indexData, { target: 34963 }), componentType: 5123, type: 'SCALAR', count: indices.length });
  function glb() {
    const bin = Buffer.concat(chunks);
    doc.buffers[0].byteLength = bin.length;
    const jsonBytes = Buffer.from(JSON.stringify(doc));
    const json = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
    const binary = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
    const header = Buffer.alloc(12);
    header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(json.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jsonHeader, json, binHeader, binary]);
  }
  return { doc, append, accessor, glb };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(width = 1, height = 1) {
  const chunk = (type, data) => {
    const header = Buffer.alloc(8); header.writeUInt32BE(data.length); header.write(type, 4);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])));
    return Buffer.concat([header, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function withImage(f, bytes = png(), mimeType = 'image/png') {
  f.doc.images = [{ mimeType, bufferView: f.append(bytes) }];
  f.doc.textures = [{ source: 0 }];
  const texCoord = f.accessor([0, 0, 1, 0, 0, 1], 'VEC2');
  f.doc.meshes[0].primitives[0].attributes.TEXCOORD_0 = texCoord;
  f.doc.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  return f;
}
function withAnimation(f, { times = [0, 1], values = [0, 0, 0, 1, 2, 3], path = 'translation', interpolation = 'LINEAR' } = {}) {
  const input = f.accessor(times, 'SCALAR');
  const output = f.accessor(values, path === 'rotation' ? 'VEC4' : 'VEC3');
  f.doc.animations = [{ name: 'strike', samplers: [{ input, output, interpolation }], channels: [{ sampler: 0, target: { node: 0, path } }] }];
  return f;
}
function near(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-8, `${n} != ${expected[i]}`));
}

test('measures transformed, indexed world geometry rather than accessor bounds', () => {
  const f = fixture({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 1] });
  f.doc.accessors[0].min = [-999, -999, -999];
  f.doc.accessors[0].max = [999, 999, 999];
  f.doc.nodes = [
    { name: 'stage', translation: [10, 20, 30], children: [1] },
    { name: 'hand-baton', mesh: 0, rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2], scale: [2, 3, 4] },
  ];
  const bytes = f.glb();
  const result = inspectGlb(bytes, { expectedDimensions: [3, 2, 4], dimensionTolerance: 0.001 });
  near(result.bounds.min, [7, 20, 30]); near(result.bounds.max, [10, 22, 34]); near(result.dimensions, [3, 2, 4]);
  assert.equal(result.triangles, 1); assert.equal(result.sceneTriangles, 1);
  assert.equal(result.primitiveCount, 1); assert.equal(result.materialCount, 1);
  assert.deepEqual(result.nodeNames, ['stage', 'hand-baton']);
  assert.deepEqual(result.animationNames, []); assert.deepEqual(result.textures, []);
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.byteLength, bytes.length);
});

test('accepts Uint8Array slices without reading surrounding bytes', () => {
  const bytes = fixture().glb();
  const wrapped = Buffer.concat([Buffer.alloc(7, 0xff), bytes, Buffer.alloc(11, 0xff)]);
  const slice = new Uint8Array(wrapped.buffer, wrapped.byteOffset + 7, bytes.length);
  assert.equal(inspectGlb(slice).byteLength, bytes.length);
});

test('counts mesh instances separately and applies matrix transforms', () => {
  const f = fixture();
  f.doc.nodes.push({ name: 'instance', mesh: 0, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1] });
  f.doc.scenes[0].nodes.push(1);
  const result = inspectGlb(f.glb());
  assert.equal(result.triangles, 1); assert.equal(result.sceneTriangles, 2);
  assert.deepEqual(result.dimensions, [3, 1, 0]);
  assert.throws(() => inspectGlb(f.glb(), { maxTriangles: 1 }), /scene triangles/);
});

test('uses the declared default scene and first scene when default is omitted', () => {
  const f = fixture();
  f.doc.nodes.push({ mesh: 0, translation: [8, 0, 0] });
  f.doc.scenes.push({ nodes: [1] }); f.doc.scene = 1;
  assert.deepEqual(inspectGlb(f.glb()).bounds.min, [8, 0, 0]);
  delete f.doc.scene;
  assert.deepEqual(inspectGlb(f.glb()).bounds.min, [0, 0, 0]);
});

test('supports interleaved POSITION data with valid stride', () => {
  assert.deepEqual(inspectGlb(fixture({ stride: 16 }).glb()).dimensions, [1, 1, 0]);
});

test('ignores unused vertices for drawn bounds and supports non-indexed triangles', () => {
  const f = fixture({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 500, 500, 500] });
  assert.deepEqual(inspectGlb(f.glb()).dimensions, [1, 1, 0]);
  const unindexed = fixture(); delete unindexed.doc.meshes[0].primitives[0].indices;
  assert.equal(inspectGlb(unindexed.glb()).triangles, 1);
});

test('inspects embedded PNG dimensions and counts image payload once', () => {
  const bytes = png(); const f = withImage(fixture(), bytes);
  f.doc.textures.push({ source: 0 });
  assert.deepEqual(inspectGlb(f.glb()).textures, [{ mimeType: 'image/png', width: 1, height: 1, bytes: bytes.length }]);
});

test('reads JPEG frame dimensions without claiming pixel decode', () => {
  // Authored JPEG structural header/scan fixture, not a decoded-image assertion.
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 2, 0, 3, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0,
    0xff, 0xda, 0, 12, 3, 1, 0, 2, 0, 3, 0, 0, 63, 0, 1, 0xff, 0xd9,
  ]);
  assert.deepEqual(inspectGlb(withImage(fixture(), jpeg, 'image/jpeg').glb()).textures,
    [{ mimeType: 'image/jpeg', width: 3, height: 2, bytes: jpeg.length }]);
});

test('supports declared unlit and texture-transform extensions', () => {
  const f = withImage(fixture());
  f.doc.extensionsUsed = ['KHR_materials_unlit', 'KHR_texture_transform'];
  f.doc.extensionsRequired = ['KHR_materials_unlit'];
  f.doc.materials[0].extensions = { KHR_materials_unlit: {} };
  f.doc.materials[0].pbrMetallicRoughness.baseColorTexture.extensions = { KHR_texture_transform: { offset: [0.1, 0], scale: [2, 1], rotation: 0.5 } };
  assert.equal(inspectGlb(f.glb()).materialCount, 1);
});

for (const [label, mutate, pattern] of [
  ['wrong magic', (b) => { b.write('oops'); }, /magic/],
  ['wrong GLB version', (b) => { b.writeUInt32LE(1, 4); }, /version 2/],
  ['declared length mismatch', (b) => { b.writeUInt32LE(b.length + 4, 8); }, /declared GLB length/],
  ['chunk beyond container', (b) => { b.writeUInt32LE(b.length * 2, 12); }, /chunk extends/],
  ['misaligned chunk', (b) => { b.writeUInt32LE(b.readUInt32LE(12) - 1, 12); }, /aligned/],
  ['invalid JSON', (b) => { b[20] = 0; }, /UTF-8 JSON/],
  ['non-JSON first chunk', (b) => { b.writeUInt32LE(0x004e4942, 16); }, /JSON chunk followed/],
]) test(`rejects ${label}`, () => {
  const bytes = fixture().glb(); mutate(bytes);
  assert.throws(() => inspectGlb(bytes), pattern);
});

test('rejects truncated headers and truncated GLB bytes', () => {
  assert.throws(() => inspectGlb(Buffer.alloc(12)), /truncated/);
  assert.throws(() => inspectGlb(fixture().glb().subarray(0, -1)), /declared GLB length/);
});

for (const [label, mutate, pattern] of [
  ['unsupported glTF version', (f) => { f.doc.asset.version = '1.0'; }, /glTF 2.0/],
  ['external buffer URL', (f) => { f.doc.buffers[0].uri = 'https://example.invalid/mesh.bin'; }, /buffer URIs/],
  ['external image URL', (f) => { f.doc.images = [{ uri: 'https://example.invalid/paint.png' }]; }, /image URIs/],
  ['data image URI', (f) => { f.doc.images = [{ uri: 'data:image/png;base64,AAAA' }]; }, /image URIs/],
  ['bufferView outside buffer', (f) => { f.doc.bufferViews[0].byteLength = 1000; }, /range exceeds buffer/],
  ['accessor outside bufferView', (f) => { f.doc.accessors[0].count = 4; }, /range exceeds bufferView/],
  ['invalid accessor stride', (f) => { f.doc.bufferViews[0].byteStride = 14; }, /byteStride/],
  ['invalid accessor component type', (f) => { f.doc.accessors[0].componentType = 5124; }, /component type/],
  ['zero accessor count', (f) => { f.doc.accessors[0].count = 0; }, /count must/],
  ['sparse geometry', (f) => { f.doc.accessors[0].sparse = { count: 1 }; }, /sparse/],
  ['non-triangle primitive', (f) => { f.doc.meshes[0].primitives[0].mode = 5; }, /TRIANGLES/],
  ['non-multiple-of-three index count', (f) => { f.doc.accessors[1].count = 2; }, /divisible by three/],
  ['morph targets', (f) => { f.doc.meshes[0].primitives[0].targets = []; }, /morph targets/],
  ['skin deformation', (f) => { f.doc.nodes[0].skin = 0; }, /skinning/],
  ['undeclared required extension', (f) => { f.doc.extensionsRequired = ['KHR_materials_unlit']; }, /not declared used/],
  ['matrix and TRS on one node', (f) => { f.doc.nodes[0].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; f.doc.nodes[0].translation = [0, 0, 0]; }, /matrix and TRS/],
  ['non-unit quaternion', (f) => { f.doc.nodes[0].rotation = [0, 0, 0, 2]; }, /unit length/],
  ['invalid default scene', (f) => { f.doc.scene = 99; }, /default scene reference/],
  ['duplicate scene root', (f) => { f.doc.scenes[0].nodes = [0, 0]; }, /repeats a root/],
  ['empty selected scene', (f) => { f.doc.scenes[0].nodes = []; }, /no triangle geometry/],
]) test(`rejects ${label}`, () => {
  const f = fixture(); mutate(f);
  assert.throws(() => inspectGlb(f.glb()), pattern);
});

test('rejects a non-finite actual POSITION despite finite declared min/max', () => {
  const f = fixture({ positions: [0, 0, 0, 1, NaN, 0, 0, 1, 0] });
  f.doc.accessors[0].min = [0, 0, 0]; f.doc.accessors[0].max = [1, 1, 0];
  assert.throws(() => inspectGlb(f.glb()), /non-finite/);
});

test('rejects an actual index outside the POSITION range', () => {
  assert.throws(() => inspectGlb(fixture({ indices: [0, 1, 3] }).glb()), /index 3 is outside POSITION range/);
});

test('rejects cycles even when disconnected from the selected scene', () => {
  const f = fixture(); f.doc.nodes.push({ children: [2] }, { children: [1] });
  assert.throws(() => inspectGlb(f.glb()), /cycle/);
});

test('rejects multiple parents, duplicate children and non-root scene nodes', () => {
  const f = fixture();
  f.doc.nodes = [{ children: [2] }, { children: [2] }, { mesh: 0 }]; f.doc.scenes[0].nodes = [0, 1];
  assert.throws(() => inspectGlb(f.glb()), /multiple parents/);
  f.doc.nodes[1].children = []; f.doc.nodes[0].children = [2, 2];
  assert.throws(() => inspectGlb(f.glb()), /duplicate child/);
  f.doc.nodes[0].children = [2]; f.doc.scenes[0].nodes = [2];
  assert.throws(() => inspectGlb(f.glb()), /non-root/);
});

test('rejects oversized embedded textures even when no texture references them', () => {
  const f = withImage(fixture(), png(1025, 1)); f.doc.textures = []; f.doc.materials = [];
  delete f.doc.meshes[0].primitives[0].material;
  assert.throws(() => inspectGlb(f.glb()), /1025x1 exceed policy 1024/);
});

test('rejects truncated embedded image containers', () => {
  const bytes = png().subarray(0, -2);
  assert.throws(() => inspectGlb(withImage(fixture(), bytes).glb()), /PNG/);
  assert.throws(() => inspectGlb(withImage(fixture(), Buffer.alloc(12), 'image/jpeg').glb()), /JPEG/);
});

for (const extension of ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu', 'KHR_materials_transmission']) {
  test(`rejects unsupported extension ${extension}`, () => {
    const f = fixture(); f.doc.extensionsUsed = [extension];
    assert.throws(() => inspectGlb(f.glb()), /unsupported extension/);
  });
}

test('rejects compressed image MIME types', () => {
  const f = withImage(fixture()); f.doc.images[0].mimeType = 'image/ktx2';
  assert.throws(() => inspectGlb(f.glb()), /only embedded PNG\/JPEG/);
});

test('validates rigid animation and reports names with rest-pose bounds', () => {
  const result = inspectGlb(withAnimation(fixture()).glb());
  assert.deepEqual(result.animationNames, ['strike']);
  assert.deepEqual(result.dimensions, [1, 1, 0]);
  const rotation = withAnimation(fixture(), { path: 'rotation', values: [0, 0, 0, 1, 0, 0, Math.SQRT1_2, Math.SQRT1_2] });
  assert.deepEqual(inspectGlb(rotation.glb()).animationNames, ['strike']);
});

test('validates cubic-spline animation triplet counts', () => {
  const f = withAnimation(fixture(), { interpolation: 'CUBICSPLINE', values: Array(18).fill(0) });
  assert.deepEqual(inspectGlb(f.glb()).animationNames, ['strike']);
  f.doc.accessors[3].count = 2;
  assert.throws(() => inspectGlb(f.glb()), /output type\/count/);
});

for (const times of [[0, 0], [1, 0], [-1, 0]]) test(`rejects invalid animation key times ${times}`, () => {
  assert.throws(() => inspectGlb(withAnimation(fixture(), { times }).glb()), /key times/);
});

test('rejects non-finite animation times', () => {
  assert.throws(() => inspectGlb(withAnimation(fixture(), { times: [0, Infinity] }).glb()), /non-finite/);
});

test('rejects animation output count mismatch and unsupported target paths', () => {
  const f = withAnimation(fixture(), { values: [0, 0, 0] });
  assert.throws(() => inspectGlb(f.glb()), /output type\/count/);
  const unsupported = withAnimation(fixture()); unsupported.doc.animations[0].channels[0].target.path = 'weights';
  assert.throws(() => inspectGlb(unsupported.glb()), /rigid TRS/);
});

test('rejects duplicate animation targets and invalid rotation keys', () => {
  const f = withAnimation(fixture()); f.doc.animations[0].channels.push({ sampler: 0, target: { node: 0, path: 'translation' } });
  assert.throws(() => inspectGlb(f.glb()), /duplicate node\/path/);
  const badRotation = withAnimation(fixture(), { path: 'rotation', values: [0, 0, 0, 1, 0, 0, 0, 2] });
  assert.throws(() => inspectGlb(badRotation.glb()), /unit length/);
});

test('enforces measured triangle, dimension and policy values', () => {
  const bytes = fixture().glb();
  assert.throws(() => inspectGlb(bytes, { maxTriangles: 0 }), /mesh triangles/);
  assert.throws(() => inspectGlb(bytes, { expectedDimensions: [2, 1, 0] }), /dimension 0/);
  assert.deepEqual(inspectGlb(bytes, { expectedDimensions: [1.1, 1, 0] }).dimensions, [1, 1, 0]);
  assert.throws(() => inspectGlb(bytes, { maxTriangles: NaN }), /policy.maxTriangles/);
  assert.throws(() => inspectGlb(bytes, { dimensionTolerance: -1 }), /dimensionTolerance/);
});
