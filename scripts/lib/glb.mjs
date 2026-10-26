import { createHash } from 'node:crypto';

// Static inspection only: this does not decode image pixels, execute animations,
// render assets, or establish Babylon/OBS/performance/visual acceptance. Bounds
// describe the selected scene's authored rest pose, including mesh instances.
const SUPPORTED_EXTENSIONS = new Set(['KHR_materials_unlit', 'KHR_texture_transform']);
const COMPONENTS = new Map([
  [5120, [1, 'getInt8']], [5121, [1, 'getUint8']],
  [5122, [2, 'getInt16']], [5123, [2, 'getUint16']],
  [5125, [4, 'getUint32']], [5126, [4, 'getFloat32']],
]);
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function requireThat(condition, message) {
  if (!condition) throw new Error(`GLB static inspection: ${message}`);
}
function record(value, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}
function array(value, label) {
  requireThat(Array.isArray(value), `${label} must be an array`);
  return value;
}
function integer(value, label, minimum = 0) {
  requireThat(Number.isSafeInteger(value) && value >= minimum, `${label} must be an integer >= ${minimum}`);
  return value;
}
function finite(value, label) {
  requireThat(typeof value === 'number' && Number.isFinite(value), `${label} must be finite`);
  return value;
}
function vector(value, size, label) {
  array(value, label);
  requireThat(value.length === size, `${label} must contain ${size} values`);
  value.forEach((n) => finite(n, label));
  return value;
}
function reference(value, collection, label) {
  integer(value, label);
  requireThat(value < collection.length, `${label} reference is out of range`);
  return collection[value];
}
function name(value, label) {
  if (value !== undefined) requireThat(typeof value === 'string', `${label}.name must be a string`);
}
function quaternion(value, label) {
  vector(value, 4, label);
  const length = Math.hypot(...value);
  requireThat(Math.abs(length - 1) <= 0.0001, `${label} quaternion must have unit length`);
  return value.map((n) => n / length);
}

function extensions(document) {
  const used = array(document.extensionsUsed ?? [], 'extensionsUsed');
  const required = array(document.extensionsRequired ?? [], 'extensionsRequired');
  requireThat(new Set(used).size === used.length && new Set(required).size === required.length, 'extension declarations contain duplicates');
  for (const extension of [...used, ...required]) {
    requireThat(typeof extension === 'string' && SUPPORTED_EXTENSIONS.has(extension), `unsupported extension ${String(extension)} (compressed streams are not admitted)`);
  }
  for (const extension of required) requireThat(used.includes(extension), `required extension ${extension} is not declared used`);
  const pending = [document];
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      // extras are application metadata, not glTF extension declarations.
      if (key === 'extras') continue;
      if (key === 'extensions') {
        record(child, 'extensions');
        for (const extension of Object.keys(child)) {
          requireThat(SUPPORTED_EXTENSIONS.has(extension) && used.includes(extension), `unsupported or undeclared extension ${extension}`);
        }
      }
      if (child !== null && typeof child === 'object') pending.push(child);
    }
  }
}

function container(bytes) {
  requireThat(bytes instanceof Uint8Array, 'input must be a Buffer or Uint8Array');
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  requireThat(input.length >= 20, 'truncated GLB header/chunk');
  requireThat(input.toString('ascii', 0, 4) === 'glTF', 'invalid GLB magic');
  requireThat(input.readUInt32LE(4) === 2, 'only GLB version 2 is supported');
  requireThat(input.readUInt32LE(8) === input.length, 'declared GLB length does not match input');
  let offset = 12;
  const chunks = [];
  while (offset < input.length) {
    requireThat(offset + 8 <= input.length, 'truncated chunk header');
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    requireThat(length % 4 === 0 && length > 0, 'chunk length must be positive and aligned to four bytes');
    const end = offset + 8 + length;
    requireThat(end <= input.length, 'chunk extends beyond declared GLB length');
    chunks.push({ type, data: input.subarray(offset + 8, end) });
    offset = end;
  }
  requireThat(chunks.length === 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942,
    'baseline requires exactly one JSON chunk followed by one BIN chunk');
  let document;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(chunks[0].data));
  } catch {
    throw new Error('GLB static inspection: JSON chunk is not valid UTF-8 JSON');
  }
  record(document, 'glTF document');
  record(document.asset, 'asset');
  requireThat(document.asset.version === '2.0' && (document.asset.minVersion === undefined || document.asset.minVersion === '2.0'), 'only glTF 2.0 is supported');
  return { input, document, binary: chunks[1].data };
}

function pngDimensions(bytes) {
  requireThat(bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'invalid or truncated PNG image');
  let offset = 8;
  let dimensions;
  let imageData = false;
  let ended = false;
  while (offset < bytes.length) {
    requireThat(offset + 12 <= bytes.length, 'truncated PNG chunk');
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    requireThat(end <= bytes.length, 'PNG chunk exceeds embedded image');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (offset === 8) requireThat(type === 'IHDR' && length === 13, 'PNG must start with a 13-byte IHDR');
    if (type === 'IHDR') {
      requireThat(!dimensions && length === 13, 'duplicate or invalid PNG IHDR');
      dimensions = [bytes.readUInt32BE(offset + 8), bytes.readUInt32BE(offset + 12)];
      const depth = bytes[offset + 16];
      const color = bytes[offset + 17];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      requireThat(depths[color]?.includes(depth) && bytes[offset + 18] === 0 && bytes[offset + 19] === 0 && bytes[offset + 20] <= 1, 'unsupported or invalid PNG IHDR');
    } else if (type === 'IDAT') {
      imageData ||= length > 0;
    } else if (type === 'IEND') {
      requireThat(length === 0 && end === bytes.length, 'invalid PNG IEND or trailing bytes');
      ended = true;
    }
    offset = end;
  }
  requireThat(dimensions && dimensions.every((n) => n > 0) && imageData && ended, 'PNG needs positive dimensions, image data and IEND');
  return dimensions;
}

function jpegDimensions(bytes) {
  requireThat(bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9, 'invalid or truncated JPEG image');
  let offset = 2;
  let dimensions;
  while (offset < bytes.length - 2) {
    requireThat(bytes[offset++] === 0xff, 'invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    requireThat(marker !== undefined && marker !== 0 && marker !== 0xd8 && marker !== 0xd9 && !(marker >= 0xd0 && marker <= 0xd7), 'unexpected JPEG marker before scan');
    requireThat(offset + 2 <= bytes.length, 'truncated JPEG segment');
    const length = bytes.readUInt16BE(offset);
    const end = offset + length;
    requireThat(length >= 2 && end <= bytes.length - 2, 'JPEG segment exceeds embedded image');
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      requireThat([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8 && !dimensions, 'unsupported or duplicate JPEG frame');
      const components = bytes[offset + 7];
      requireThat(bytes[offset + 2] === 8 && [1, 3].includes(components) && length === 8 + 3 * components, 'unsupported JPEG frame encoding');
      dimensions = [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    if (marker === 0xda) {
      requireThat(dimensions && dimensions.every((n) => n > 0) && end < bytes.length - 2, 'JPEG scan requires positive frame dimensions and data');
      return dimensions;
    }
    offset = end;
  }
  throw new Error('GLB static inspection: JPEG has no supported image scan');
}

function multiply(a, b) {
  const result = Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  requireThat(result.every(Number.isFinite), 'world transform overflowed');
  return result;
}

function localMatrix(node, label) {
  requireThat(node.matrix === undefined || [node.translation, node.rotation, node.scale].every((value) => value === undefined), `${label} cannot combine matrix and TRS`);
  if (node.matrix !== undefined) {
    const matrix = vector(node.matrix, 16, `${label}.matrix`);
    requireThat(matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1, `${label}.matrix must be affine`);
    // glTF matrices must be decomposable into TRS; reject shear explicitly.
    const columns = [matrix.slice(0, 3), matrix.slice(4, 7), matrix.slice(8, 11)];
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
      const product = Math.hypot(...columns[a]) * Math.hypot(...columns[b]);
      const dot = columns[a].reduce((sum, n, i) => sum + n * columns[b][i], 0);
      requireThat(Number.isFinite(product) && Number.isFinite(dot) && Math.abs(dot) <= Math.max(product * 0.00001, 1e-12), `${label}.matrix contains unsupported shear`);
    }
    return matrix;
  }
  const [x, y, z, w] = quaternion(node.rotation ?? [0, 0, 0, 1], `${label}.rotation`);
  const [sx, sy, sz] = vector(node.scale ?? [1, 1, 1], 3, `${label}.scale`);
  const [tx, ty, tz] = vector(node.translation ?? [0, 0, 0], 3, `${label}.translation`);
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/** Inspect a deliberately narrow, uncompressed, rigid-TRS glTF 2.0 pipeline. */
export function inspectGlb(bytes, policy = {}) {
  record(policy, 'policy');
  const maxTriangles = integer(policy.maxTriangles ?? 120000, 'policy.maxTriangles');
  const maxTextureDimension = integer(policy.maxTextureDimension ?? 1024, 'policy.maxTextureDimension', 1);
  const tolerance = finite(policy.dimensionTolerance ?? 0.15, 'policy.dimensionTolerance');
  requireThat(tolerance >= 0 && tolerance <= 1, 'policy.dimensionTolerance must be between zero and one');
  const expected = policy.expectedDimensions === undefined ? undefined : vector(policy.expectedDimensions, 3, 'policy.expectedDimensions');
  if (expected) requireThat(expected.every((n) => n >= 0), 'expected dimensions cannot be negative');
  const { input, document: gltf, binary } = container(bytes);
  extensions(gltf);
  requireThat(array(gltf.skins ?? [], 'skins').length === 0, 'skins are unsupported; use rigid node TRS animation');
  const buffers = array(gltf.buffers, 'buffers');
  requireThat(buffers.length === 1, 'exactly one embedded buffer is required');
  record(buffers[0], 'buffers[0]');
  requireThat(buffers[0].uri === undefined, 'external/data buffer URIs are unsupported');
  const bufferLength = integer(buffers[0].byteLength, 'buffer byteLength', 1);
  requireThat(bufferLength <= binary.length && binary.length - bufferLength <= 3, 'BIN length does not match embedded buffer byteLength');
  requireThat(binary.subarray(bufferLength).every((value) => value === 0), 'BIN padding must contain zero bytes');
  const views = array(gltf.bufferViews ?? [], 'bufferViews').map((entry, i) => {
    const label = `bufferViews[${i}]`;
    record(entry, label);
    requireThat(entry.buffer === 0, `${label} must reference the embedded buffer`);
    const offset = integer(entry.byteOffset ?? 0, `${label}.byteOffset`);
    const length = integer(entry.byteLength, `${label}.byteLength`, 1);
    requireThat(offset + length <= bufferLength, `${label} range exceeds buffer`);
    if (entry.byteStride !== undefined) {
      integer(entry.byteStride, `${label}.byteStride`, 4);
      requireThat(entry.byteStride <= 252 && entry.byteStride % 4 === 0, `${label}.byteStride must be four-byte aligned and <= 252`);
    }
    requireThat(entry.target === undefined || [34962, 34963].includes(entry.target), `${label} has invalid target`);
    return { ...entry, offset, length };
  });
  const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const accessors = array(gltf.accessors ?? [], 'accessors').map((entry, i) => {
    const label = `accessors[${i}]`;
    record(entry, label);
    requireThat(entry.sparse === undefined, `${label}: sparse accessors are unsupported`);
    const view = reference(entry.bufferView, views, `${label}.bufferView`);
    const component = COMPONENTS.get(entry.componentType);
    requireThat(component && WIDTHS[entry.type], `${label}: unsupported component type or accessor type (matrix accessors are unsupported)`);
    const [size, reader] = component;
    const width = WIDTHS[entry.type];
    const count = integer(entry.count, `${label}.count`, 1);
    const offset = integer(entry.byteOffset ?? 0, `${label}.byteOffset`);
    const stride = view.byteStride ?? size * width;
    requireThat(offset % size === 0 && (view.offset + offset) % size === 0 && stride % size === 0 && stride >= size * width, `${label}: invalid accessor alignment or stride`);
    requireThat(offset + (count - 1) * stride + size * width <= view.length, `${label} range exceeds bufferView`);
    requireThat(entry.normalized === undefined || typeof entry.normalized === 'boolean', `${label}.normalized must be boolean`);
    requireThat(!entry.normalized || [5120, 5121, 5122, 5123].includes(entry.componentType), `${label}: invalid normalized component type`);
    for (const bound of ['min', 'max']) if (entry[bound] !== undefined) vector(entry[bound], width, `${label}.${bound}`);
    const read = (element, axis = 0) => data[reader](view.offset + offset + element * stride + axis * size, true);
    // Inspect actual values even when min/max metadata claims they are safe.
    if (entry.componentType === 5126) for (let element = 0; element < count; element++) {
      for (let axis = 0; axis < width; axis++) requireThat(Number.isFinite(read(element, axis)), `${label} contains a non-finite value`);
    }
    return { ...entry, view, count, width, stride, offset, read };
  });

  const imageEntries = array(gltf.images ?? [], 'images');
  const textures = imageEntries.map((entry, i) => {
    const label = `images[${i}]`;
    record(entry, label);
    requireThat(entry.uri === undefined, `${label}: external/data image URIs are unsupported`);
    requireThat(['image/png', 'image/jpeg'].includes(entry.mimeType), `${label}: only embedded PNG/JPEG are supported (KTX/compressed textures are unsupported)`);
    const view = reference(entry.bufferView, views, `${label}.bufferView`);
    requireThat(view.byteStride === undefined && view.target === undefined, `${label} bufferView cannot have stride or target`);
    const image = binary.subarray(view.offset, view.offset + view.length);
    const [width, height] = entry.mimeType === 'image/png' ? pngDimensions(image) : jpegDimensions(image);
    requireThat(width <= maxTextureDimension && height <= maxTextureDimension, `${label} texture dimensions ${width}x${height} exceed policy ${maxTextureDimension}`);
    return { mimeType: entry.mimeType, width, height, bytes: image.length };
  });
  const samplers = array(gltf.samplers ?? [], 'samplers');
  samplers.forEach((entry, i) => {
    record(entry, `samplers[${i}]`);
    requireThat(entry.magFilter === undefined || [9728, 9729].includes(entry.magFilter), `samplers[${i}] has invalid magFilter`);
    requireThat(entry.minFilter === undefined || [9728, 9729, 9984, 9985, 9986, 9987].includes(entry.minFilter), `samplers[${i}] has invalid minFilter`);
    for (const field of ['wrapS', 'wrapT']) requireThat(entry[field] === undefined || [33071, 33648, 10497].includes(entry[field]), `samplers[${i}] has invalid ${field}`);
  });
  const textureEntries = array(gltf.textures ?? [], 'textures');
  textureEntries.forEach((entry, i) => {
    record(entry, `textures[${i}]`);
    reference(entry.source, imageEntries, `textures[${i}].source`);
    if (entry.sampler !== undefined) reference(entry.sampler, samplers, `textures[${i}].sampler`);
  });
  function textureInfo(info, label) {
    record(info, label);
    reference(info.index, textureEntries, `${label}.index`);
    requireThat(info.texCoord === undefined || [0, 1].includes(info.texCoord), `${label}: only TEXCOORD_0/1 are supported`);
    const transform = info.extensions?.KHR_texture_transform;
    if (transform !== undefined) {
      record(transform, `${label}.KHR_texture_transform`);
      if (transform.offset !== undefined) vector(transform.offset, 2, `${label}.offset`);
      if (transform.scale !== undefined) vector(transform.scale, 2, `${label}.scale`);
      if (transform.rotation !== undefined) finite(transform.rotation, `${label}.rotation`);
      requireThat(transform.texCoord === undefined || [0, 1].includes(transform.texCoord), `${label}: invalid transform texCoord`);
    }
  }
  function factor(value, size, label) {
    vector(value, size, label);
    requireThat(value.every((n) => n >= 0 && n <= 1), `${label} must be between zero and one`);
  }
  const materials = array(gltf.materials ?? [], 'materials');
  materials.forEach((entry, i) => {
    const label = `materials[${i}]`;
    record(entry, label);
    if (entry.extensions?.KHR_materials_unlit !== undefined) record(entry.extensions.KHR_materials_unlit, `${label}.KHR_materials_unlit`);
    const pbr = entry.pbrMetallicRoughness ?? {};
    record(pbr, `${label}.pbrMetallicRoughness`);
    if (pbr.baseColorFactor !== undefined) factor(pbr.baseColorFactor, 4, `${label}.baseColorFactor`);
    for (const field of ['metallicFactor', 'roughnessFactor']) if (pbr[field] !== undefined) factor([pbr[field]], 1, `${label}.${field}`);
    for (const field of ['baseColorTexture', 'metallicRoughnessTexture']) if (pbr[field] !== undefined) textureInfo(pbr[field], `${label}.${field}`);
    for (const field of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (entry[field] !== undefined) textureInfo(entry[field], `${label}.${field}`);
    if (entry.normalTexture?.scale !== undefined) finite(entry.normalTexture.scale, `${label}.normalTexture.scale`);
    if (entry.occlusionTexture?.strength !== undefined) factor([entry.occlusionTexture.strength], 1, `${label}.occlusionTexture.strength`);
    if (entry.emissiveFactor !== undefined) factor(entry.emissiveFactor, 3, `${label}.emissiveFactor`);
    requireThat(entry.alphaMode === undefined || ['OPAQUE', 'MASK', 'BLEND'].includes(entry.alphaMode), `${label}: invalid alphaMode`);
    if (entry.alphaCutoff !== undefined) requireThat(finite(entry.alphaCutoff, `${label}.alphaCutoff`) >= 0, `${label}: negative alphaCutoff`);
    requireThat(entry.doubleSided === undefined || typeof entry.doubleSided === 'boolean', `${label}.doubleSided must be boolean`);
  });

  let triangles = 0;
  let primitiveCount = 0;
  const meshes = array(gltf.meshes ?? [], 'meshes').map((entry, meshIndex) => {
    const meshLabel = `meshes[${meshIndex}]`;
    record(entry, meshLabel);
    requireThat(entry.weights === undefined, `${meshLabel}: morph weights are unsupported`);
    const primitives = array(entry.primitives, `${meshLabel}.primitives`);
    requireThat(primitives.length > 0, `${meshLabel} has no primitives`);
    return primitives.map((primitive, primitiveIndex) => {
      const label = `${meshLabel}.primitives[${primitiveIndex}]`;
      record(primitive, label);
      requireThat(primitive.mode === undefined || primitive.mode === 4, `${label}: only TRIANGLES mode is supported`);
      requireThat(primitive.targets === undefined, `${label}: morph targets are unsupported`);
      record(primitive.attributes, `${label}.attributes`);
      const position = reference(primitive.attributes.POSITION, accessors, `${label}.POSITION`);
      requireThat(position.type === 'VEC3' && position.componentType === 5126 && !position.normalized, `${label}.POSITION must be unnormalized FLOAT VEC3`);
      for (const [semantic, index] of Object.entries(primitive.attributes)) {
        const attribute = reference(index, accessors, `${label}.${semantic}`);
        requireThat(attribute.count === position.count, `${label}.${semantic} count differs from POSITION`);
        requireThat(attribute.view.target !== 34963 && (attribute.view.offset + attribute.offset) % 4 === 0 && attribute.stride % 4 === 0, `${label}.${semantic} has invalid vertex alignment/target`);
        let valid = false;
        if (semantic === 'POSITION' || semantic === 'NORMAL') valid = attribute.type === 'VEC3' && attribute.componentType === 5126 && !attribute.normalized;
        else if (semantic === 'TANGENT') valid = attribute.type === 'VEC4' && attribute.componentType === 5126 && !attribute.normalized;
        else if (['TEXCOORD_0', 'TEXCOORD_1'].includes(semantic)) valid = attribute.type === 'VEC2' && ((attribute.componentType === 5126 && !attribute.normalized) || ([5121, 5123].includes(attribute.componentType) && attribute.normalized));
        else if (semantic === 'COLOR_0') valid = ['VEC3', 'VEC4'].includes(attribute.type) && ((attribute.componentType === 5126 && !attribute.normalized) || ([5121, 5123].includes(attribute.componentType) && attribute.normalized));
        requireThat(valid, `${label}: unsupported or invalid attribute ${semantic}`);
      }
      if (primitive.material !== undefined) reference(primitive.material, materials, `${label}.material`);
      const indices = primitive.indices === undefined ? undefined : reference(primitive.indices, accessors, `${label}.indices`);
      if (indices) {
        requireThat(indices.type === 'SCALAR' && [5121, 5123, 5125].includes(indices.componentType) && !indices.normalized && indices.view.byteStride === undefined && indices.view.target !== 34962, `${label}.indices must be tightly packed unsigned SCALAR`);
        const restart = { 5121: 255, 5123: 65535, 5125: 4294967295 }[indices.componentType];
        for (let i = 0; i < indices.count; i++) requireThat(indices.read(i) < position.count && indices.read(i) !== restart, `${label}: index ${indices.read(i)} is outside POSITION range or is a restart sentinel`);
      }
      const count = indices?.count ?? position.count;
      requireThat(count % 3 === 0, `${label}: triangle vertex/index count must be divisible by three`);
      triangles += count / 3;
      primitiveCount++;
      requireThat(triangles <= maxTriangles, `mesh triangles ${triangles} exceed policy ${maxTriangles}`);
      return { position, indices, count, triangles: count / 3 };
    });
  });

  const nodes = array(gltf.nodes ?? [], 'nodes');
  const parents = Array(nodes.length).fill(-1);
  const matrices = nodes.map((node, i) => {
    const label = `nodes[${i}]`;
    record(node, label);
    name(node.name, label);
    requireThat(node.skin === undefined && node.weights === undefined, `${label}: skinning and morph weights are unsupported`);
    if (node.mesh !== undefined) reference(node.mesh, meshes, `${label}.mesh`);
    if (node.camera !== undefined) throw new Error(`GLB static inspection: ${label}: cameras are unsupported in the asset baseline`);
    const children = array(node.children ?? [], `${label}.children`);
    for (const child of children) {
      reference(child, nodes, `${label}.children`);
      requireThat(parents[child] === -1, `node ${child} has multiple parents or a duplicate child reference`);
      parents[child] = i;
    }
    return localMatrix(node, label);
  });
  // A bounded iterative traversal also detects disconnected cycles.
  const roots = nodes.flatMap((_, i) => parents[i] === -1 ? [i] : []);
  const pendingNodes = [...roots];
  let visited = 0;
  while (pendingNodes.length) {
    const node = nodes[pendingNodes.pop()];
    visited++;
    pendingNodes.push(...(node.children ?? []));
  }
  requireThat(visited === nodes.length, 'node graph contains a cycle');
  const scenes = array(gltf.scenes, 'scenes');
  requireThat(scenes.length > 0, 'at least one declared scene is required');
  scenes.forEach((scene, i) => {
    record(scene, `scenes[${i}]`);
    const sceneRoots = array(scene.nodes ?? [], `scenes[${i}].nodes`);
    requireThat(new Set(sceneRoots).size === sceneRoots.length, `scenes[${i}] repeats a root node`);
    sceneRoots.forEach((root) => {
      reference(root, nodes, `scenes[${i}].nodes`);
      requireThat(parents[root] === -1, `scenes[${i}] includes a non-root node`);
    });
  });
  const scene = reference(gltf.scene ?? 0, scenes, 'default scene');

  const animations = array(gltf.animations ?? [], 'animations');
  animations.forEach((animation, animationIndex) => {
    const label = `animations[${animationIndex}]`;
    record(animation, label);
    name(animation.name, label);
    const animationSamplers = array(animation.samplers, `${label}.samplers`);
    const channels = array(animation.channels, `${label}.channels`);
    requireThat(animationSamplers.length > 0 && channels.length > 0, `${label} must have samplers and channels`);
    animationSamplers.forEach((sampler, i) => {
      record(sampler, `${label}.samplers[${i}]`);
      const times = reference(sampler.input, accessors, `${label}.samplers[${i}].input`);
      reference(sampler.output, accessors, `${label}.samplers[${i}].output`);
      requireThat(times.type === 'SCALAR' && times.componentType === 5126 && !times.normalized && times.view.byteStride === undefined, `${label}: animation times must be tightly packed FLOAT SCALAR`);
      requireThat(['LINEAR', 'STEP', 'CUBICSPLINE'].includes(sampler.interpolation ?? 'LINEAR'), `${label}: unsupported interpolation`);
      for (let key = 0; key < times.count; key++) requireThat(times.read(key) >= 0 && (key === 0 || times.read(key) > times.read(key - 1)), `${label}: key times must be nonnegative and strictly increasing`);
    });
    const targets = new Set();
    const usedSamplers = new Set();
    channels.forEach((channel, i) => {
      record(channel, `${label}.channels[${i}]`);
      const sampler = reference(channel.sampler, animationSamplers, `${label}.channel.sampler`);
      record(channel.target, `${label}.channel.target`);
      const target = reference(channel.target.node, nodes, `${label}.channel.target.node`);
      const path = channel.target.path;
      requireThat(['translation', 'rotation', 'scale'].includes(path), `${label}: only rigid TRS animation channels are supported`);
      requireThat(target.matrix === undefined, `${label}: matrix nodes cannot be animated`);
      const key = `${channel.target.node}:${path}`;
      requireThat(!targets.has(key), `${label}: duplicate node/path animation channel`);
      targets.add(key);
      usedSamplers.add(channel.sampler);
      const times = accessors[sampler.input];
      const values = accessors[sampler.output];
      const cubic = sampler.interpolation === 'CUBICSPLINE';
      requireThat(values.type === (path === 'rotation' ? 'VEC4' : 'VEC3') && values.componentType === 5126 && !values.normalized && values.view.byteStride === undefined && values.count === times.count * (cubic ? 3 : 1), `${label}: animation output type/count does not match target/key times`);
      if (path === 'rotation') for (let frame = 0; frame < times.count; frame++) {
        const index = cubic ? frame * 3 + 1 : frame;
        quaternion(Array.from({ length: 4 }, (_, axis) => values.read(index, axis)), `${label}.rotation key`);
      }
    });
    requireThat(usedSamplers.size === animationSamplers.length, `${label}: unused animation samplers are unsupported`);
  });

  let sceneTriangles = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const stack = (scene.nodes ?? []).map((index) => ({ index, parent: IDENTITY }));
  while (stack.length) {
    const { index, parent } = stack.pop();
    const node = nodes[index];
    const world = multiply(parent, matrices[index]);
    if (node.mesh !== undefined) for (const primitive of meshes[node.mesh]) {
      sceneTriangles += primitive.triangles;
      requireThat(sceneTriangles <= maxTriangles, `scene triangles ${sceneTriangles} exceed policy ${maxTriangles}`);
      for (let vertex = 0; vertex < primitive.count; vertex++) {
        const element = primitive.indices ? primitive.indices.read(vertex) : vertex;
        const x = primitive.position.read(element, 0);
        const y = primitive.position.read(element, 1);
        const z = primitive.position.read(element, 2);
        for (let axis = 0; axis < 3; axis++) {
          const coordinate = world[axis] * x + world[4 + axis] * y + world[8 + axis] * z + world[12 + axis];
          requireThat(Number.isFinite(coordinate), 'world-space POSITION overflowed');
          min[axis] = Math.min(min[axis], coordinate);
          max[axis] = Math.max(max[axis], coordinate);
        }
      }
    }
    for (const child of node.children ?? []) stack.push({ index: child, parent: world });
  }
  requireThat(sceneTriangles > 0, 'selected scene has no triangle geometry');
  const dimensions = max.map((value, axis) => value - min[axis]);
  requireThat(dimensions.every(Number.isFinite), 'scene dimensions overflowed');
  if (expected) expected.forEach((value, axis) => requireThat(Math.abs(dimensions[axis] - value) <= Math.max(value * tolerance, 1e-6), `dimension ${axis} is ${dimensions[axis]}, expected ${value} within tolerance ${tolerance}`));
  return {
    sha256: createHash('sha256').update(input).digest('hex'), byteLength: input.length,
    triangles, sceneTriangles, primitiveCount, materialCount: materials.length,
    dimensions, bounds: { min, max },
    nodeNames: nodes.flatMap((node) => node.name === undefined ? [] : [node.name]),
    animationNames: animations.flatMap((animation) => animation.name === undefined ? [] : [animation.name]),
    // One record per embedded image, including unreferenced images: texture aliases
    // must not double-count payload, and unused oversized images must not slip in.
    textures,
  };
}
