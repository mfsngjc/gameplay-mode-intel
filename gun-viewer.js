import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGunViewport, makeOption } from './gun-model-stage.js?v=20261116-cod';

const cdn = new URL('https://cdn.battlefield6tracker.com/gunsmith3d/');
const format = 'bf6-gunsmith-cdn-1';
let manifestRequest;

function assetUrl(path) {
  if (!/^[\w-][\w./-]*$/.test(path || '') || path.split('/').includes('..')) {
    throw new Error('无效的预览资源地址');
  }
  return new URL(path, cdn).href;
}

async function fetchAsset(path, signal) {
  const response = await fetch(assetUrl(path), {
    credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(45000)])
  });
  if (!response.ok) throw new Error('素材源暂不可用（' + response.status + '）');
  return response;
}

async function fetchData(path, signal = new AbortController().signal) {
  const response = await fetchAsset(path, signal);
  const data = await response.json();
  if (data.format !== format) throw new Error('素材源格式已变更');
  return data;
}

function liveManifest() {
  manifestRequest ??= fetchData('channels.json')
    .then(data => fetchData(data.channels.live.manifest))
    .catch(error => { manifestRequest = null; throw error; });
  return manifestRequest;
}

function attachmentGroups(weapon) {
  const visible = new Set();
  for (const slot of weapon.slots) {
    slot.entries.forEach((id, index) => {
      const part = weapon.entries[id];
      if (part?.meshes.some(mesh => weapon.geo[mesh.geo])) {
        visible.add(part.item);
        slot.selectors[index]?.forEach(item => visible.add(item));
      }
    });
  }
  const groups = new Map();
  for (const [id, item] of Object.entries(weapon.attachments)) {
    if (!item.slot_cn || !item.unlocks.some(key => visible.has(key))) continue;
    if (!groups.has(item.slot)) groups.set(item.slot, { label: item.slot_cn, items: [] });
    groups.get(item.slot).items.push([id, item.name_cn || item.name_en]);
  }
  return groups;
}

function resolveParts(weapon, skin, loadout) {
  const selectedItems = new Set([weapon.weapon_item, skin.mdv]);
  for (const key of loadout) {
    for (const item of weapon.attachments[key]?.unlocks || []) selectedItems.add(item);
  }
  const selectedTags = new Set([...selectedItems].flatMap(item => weapon.item_var[item] || []));
  const slots = weapon.slots.filter(slot => slot.entries.length).map(slot => {
    const direct = slot.entries.flatMap((id, index) =>
      slot.selectors[index]?.some(item => selectedItems.has(item)) ||
      selectedItems.has(weapon.entries[id]?.item) ? [index] : []);
    if (!direct.length && slot.required && slot.entries[slot.default] !== undefined) direct.push(slot.default);
    return { slot, direct, chosen: direct };
  });
  const tags = new Set(selectedTags);
  for (const { slot, direct } of slots) {
    for (const i of direct) {
      for (const bit of weapon.entries[slot.entries[i]].sets) tags.add(bit);
    }
  }
  // Variant rules resolve the game’s alternate parts from the loadout and skin tags.
  for (const item of slots) {
    const matching = item.slot.rules
      .filter(rule => rule.conds.every(tag => tags.has(tag)))
      .sort((a, b) => b.prio - a.prio);
    const variant = matching.find(rule => rule.kind === 1);
    const disabled = new Set(matching.filter(rule => rule.kind === 0).flatMap(rule => rule.outs));
    item.chosen = [...new Set(variant?.outs || item.direct)].filter(index => !disabled.has(index));
  }
  const parts = slots.flatMap(({ slot, chosen }) =>
    chosen.map(index => weapon.entries[slot.entries[index]]).filter(Boolean));
  const partItems = new Set(parts.map(part => part.item));
  parts.forEach(part => part.sets.forEach(tag => tags.add(tag)));
  return { parts, selectedItems, partItems, tags };
}

function boneMatrices(weapon, selection) {
  const unitScale = new THREE.Vector3(1, 1, 1);
  const fromPose = (position, rotation) => new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(position), new THREE.Quaternion().fromArray(rotation), unitScale
  );
  const local = weapon.bones.map(bone => bone.md_local?.length === 2
    ? fromPose(...bone.md_local) : new THREE.Matrix4().fromArray(bone.bind_local));
  const offsets = new Map();
  for (const part of selection.parts) {
    const active = part.conds.find(([item]) => item && selection.partItems.has(item)) ||
      part.conds.find(([item]) => item && selection.selectedItems.has(item));
    const fallback = part.conds.find(([item]) => !item);
    for (const [bone, pos, rotation] of part.posesets[(active || fallback)?.[1] ?? 0] || []) {
      offsets.set(bone, fromPose(pos, rotation));
    }
  }
  for (const { attach } of selection.parts) {
    if (attach?.mode === 'bone' && !offsets.has(attach.bone)) {
      offsets.set(attach.bone, new THREE.Matrix4().fromArray(attach.m));
    }
  }
  const world = [];
  return local.map((matrix, index) => {
    const bone = weapon.bones[index];
    if (offsets.has(index)) matrix.premultiply(offsets.get(index));
    world[index] = world[bone.parent] ? world[bone.parent].clone().multiply(matrix) : matrix;
    return world[index].clone().multiply(new THREE.Matrix4().fromArray(bone.inv));
  });
}

function displayMeshes(parts, tags) {
  return parts.flatMap(part => part.meshes.filter((mesh, index) => {
    if (mesh.scope > 0) return false;
    return !part.mesh_rules.some(rule => {
      if (!rule.meshes.includes(index)) return false;
      const matched = rule.conds.every(tag => tags.has(tag));
      return (rule.kind === 0 && matched) || (rule.kind === 2 && !matched);
    });
  }).map(mesh => ({ ...mesh, slot: part.slot })));
}

function posedGeometry(source, bones) {
  const geometry = source.clone();
  const labels = source.getAttribute('_bone');
  if (!labels) return geometry;
  const pos = geometry.getAttribute('position');
  const norm = geometry.getAttribute('normal');
  const normalMatrices = bones.map(matrix => new THREE.Matrix3().getNormalMatrix(matrix));
  const point = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const bone = labels.getX(i);
    if (!bones[bone]) continue;
    point.fromBufferAttribute(pos, i).applyMatrix4(bones[bone]);
    pos.setXYZ(i, point.x, point.y, point.z);
    if (norm) {
      point.fromBufferAttribute(norm, i).applyNormalMatrix(normalMatrices[bone]);
      norm.setXYZ(i, point.x, point.y, point.z);
    }
  }
  geometry.deleteAttribute('tangent');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function disposeModel(group) {
  group.traverse(node => {
    if (node.isMesh) {
      node.geometry.dispose();
      node.material.dispose();
    }
  });
}

export function mountGunViewer(host, key) {
  const cancellation = new AbortController();
  const { signal } = cancellation;
  const stage = host.querySelector('.gun-model-stage');
  const status = host.querySelector('[role="status"]');
  const skinSelect = host.querySelector('.gun-skin-select');
  const attachmentFields = host.querySelector('.gun-attachment-fields');
  const reset = host.querySelector('.gun-model-reset');
  const retry = host.querySelector('.gun-model-retry');
  const resetView = host.querySelector('.gun-model-recenter');
  const loader = new GLTFLoader();
  const geoCache = new Map();
  const texCache = new Map();
  let viewport;
  let currentGroup;
  let revision = 0;
  let weapon;
  let setup;
  let groups;
  let chosen;

  const announce = message => { status.textContent = message; status.hidden = !message; };

  function geometry(path) {
    if (!geoCache.has(path)) {
      geoCache.set(path, fetchAsset(path, signal).then(r => r.arrayBuffer())
        .then(buffer => loader.parseAsync(buffer, cdn.href))
        .then(model => {
          const meshes = [];
          model.scene.traverse(node => {
            if (node.isMesh) {
              meshes.push(node.geometry);
              (Array.isArray(node.material) ? node.material : [node.material]).forEach(mat => mat.dispose());
            }
          });
          if (signal.aborted) meshes.forEach(mesh => mesh.dispose());
          return meshes;
        }).catch(error => { geoCache.delete(path); throw error; }));
    }
    return geoCache.get(path);
  }

  function texture(key) {
    const path = weapon.textures[key]?.lo;
    if (!path) return Promise.resolve(null);
    if (!texCache.has(path)) {
      texCache.set(path, fetchAsset(path, signal).then(r => r.blob())
        .then(blob => createImageBitmap(blob))
        .then(bitmap => {
          const texture = new THREE.Texture(bitmap);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          if (signal.aborted) { texture.dispose(); bitmap.close(); }
          return texture;
        }).catch(error => { texCache.delete(path); throw error; }));
    }
    return texCache.get(path);
  }

  async function material(id, skin, slot) {
    const source = weapon.materials[id];
    const override = skin.spo?.[slot]?.map(key => weapon.spo[key]).filter(Boolean) || [];
    const textures = Object.assign({}, source?.tex, ...override.map(entry => entry.tex));
    const palette = Object.assign({}, source?.par, ...override.map(entry => entry.par));
    if (source?.kind === 'glass' || source?.kind === 'lens' || source?.kind === 'emitter') {
      return new THREE.MeshStandardMaterial({ color: 0x839ba8, transparent: true, opacity: .19, roughness: .2, depthWrite: false, side: THREE.DoubleSide });
    }
    const camoKey = override.map(layer => layer.tex?.camo).filter(Boolean).at(-1);
    const [map, camoMap] = await Promise.all([
      texture(textures.cs || textures.wo).catch(() => null),
      skin.sid !== 'factory' && camoKey ? texture(camoKey).catch(() => null) : null
    ]);
    const tint = palette['d45185ba'];
    const color = Array.isArray(tint) && tint.slice(0, 3).every(value => value > .005)
      ? new THREE.Color(...tint.slice(0, 3).map(value => .18 + value * .74))
      : new THREE.Color(0xa1a6aa);
    const result = new THREE.MeshStandardMaterial({ map, color, roughness: .64, metalness: .20, side: THREE.DoubleSide });
    if (map) {
      result.customProgramCacheKey = () => camoMap ? 'armory-painted' : 'armory-standard';
      result.onBeforeCompile = shader => {
        if (camoMap) {
          shader.uniforms.armoryPaint = { value: camoMap };
          shader.fragmentShader = 'uniform sampler2D armoryPaint;\n' + shader.fragmentShader;
        }
        // The original game uses packed surface masks. Keep the low-detail preview readable.
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
          'vec3 surface = texture2D(map, vMapUv).rgb;\n' +
          (camoMap ? 'surface = mix(surface, texture2D(armoryPaint, vMapUv).rgb, 0.38);\n' : '') +
          'diffuseColor.rgb *= 0.24 + 0.76 * surface;');
      };
    }
    return result;
  }

  async function showModel() {
    const ticket = ++revision;
    const previous = currentGroup;
    announce(previous ? '正在更新外观…' : '正在加载枪械模型…');
    retry.hidden = true;
    const group = new THREE.Group();
    // BF6 models use +Z along the barrel. Rotate once for the side-on browsing view.
    group.rotation.y = -Math.PI / 2;
    try {
      const { skin, loadout } = setup;
      const selection = resolveParts(weapon, skin, [...chosen.values(), ...loadout]);
      const bones = boneMatrices(weapon, selection);
      const parts = displayMeshes(selection.parts, selection.tags).filter(part => weapon.geo[part.geo]);
      if (!parts.length) throw new Error('该枪暂无可展示的模型');
      const loaded = await Promise.allSettled(parts.map(async part => {
        const chunks = await geometry(weapon.geo[part.geo]);
        const mats = await Promise.all(chunks.map((_, index) =>
          material(part.mats[index] || part.mats[0], skin, part.slot)));
        for (const [index, source] of chunks.entries()) {
          group.add(new THREE.Mesh(posedGeometry(source, bones), mats[index]));
        }
      }));
      if (signal.aborted || ticket !== revision) return disposeModel(group);
      const failed = loaded.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      if (!group.children.length) throw new Error('该枪暂无可展示的模型');
      viewport.scene.add(group);
      if (currentGroup) {
        viewport.scene.remove(currentGroup);
        disposeModel(currentGroup);
      }
      currentGroup = group;
      host.classList.add('has-model');
      if (!previous) viewport.fit(group); else viewport.draw();
      announce('');
    } catch (error) {
      disposeModel(group);
      if (signal.aborted || ticket !== revision) return;
      announce(currentGroup ? '更新失败，仍显示上一次的配置。' :
        (error.message === '该枪暂无可展示的模型' ? error.message : '模型加载失败。可重试或查看素材来源。'));
      retry.hidden = false;
    }
  }

  function chooseSkin(id) {
    const skin = weapon.skins.find(item => item.sid === id) || weapon.skins[0];
    chosen = new Map();
    const loadout = [];
    for (const id of skin.attachments) {
      const slot = weapon.attachments[id]?.slot;
      if (groups.has(slot)) {
        chosen.set(slot, id);
      } else {
        loadout.push(id);
      }
    }
    setup = { skin, loadout };
    skinSelect.value = skin.sid;
    for (const select of attachmentFields.querySelectorAll('select')) {
      select.value = chosen.get(select.name) || '';
    }
    showModel();
  }

  async function initialize() {
    announce('正在读取改装选项…');
    retry.hidden = true;
    try {
      const manifest = await liveManifest();
      if (signal.aborted) return;
      const entry = manifest.weapons.find(item => item.key === key);
      if (!entry) throw new Error('该枪暂无本站 3D 预览');
      weapon = await fetchData(entry.file, signal);
      if (signal.aborted) return;
      if (!weapon.skins?.length) throw new Error('该枪暂无本站 3D 预览');
      viewport ??= createGunViewport(stage);
      const skinOptions = weapon.skins.map(item => makeOption(item.sid,
        item.name_cn || item.name_ph || (item.sid === 'factory' ? '出厂' : item.sid)));
      skinSelect.replaceChildren(...skinOptions);
      groups = attachmentGroups(weapon);
      attachmentFields.replaceChildren();
      for (const [slot, group] of groups) {
        const label = document.createElement('label');
        const select = document.createElement('select');
        select.name = slot;
        select.replaceChildren(makeOption('', '基础配置'),
          ...group.items.map(([id, name]) => makeOption(id, name)));
        label.append(group.label, select);
        attachmentFields.append(label);
      }
      host.querySelector('.gun-model-controls').hidden = false;
      resetView.hidden = false;
      chooseSkin('factory');
    } catch (error) {
      if (signal.aborted) return;
      announce(error.message === '该枪暂无本站 3D 预览'
        ? error.message : '暂时无法读取 3D 素材或启动 WebGL。');
      retry.hidden = false;
    }
  }

  skinSelect.addEventListener('change', () => chooseSkin(skinSelect.value), { signal });
  attachmentFields.addEventListener('change', event => {
    if (event.target.value) chosen.set(event.target.name, event.target.value);
    else chosen.delete(event.target.name);
    showModel();
  }, { signal });
  reset.addEventListener('click', () => chooseSkin('factory'), { signal });
  resetView.addEventListener('click', () => viewport?.fit(currentGroup), { signal });
  retry.addEventListener('click', () => setup ? showModel() : initialize(), { signal });
  initialize();

  return () => {
    cancellation.abort();
    if (currentGroup) disposeModel(currentGroup);
    for (const promise of geoCache.values()) {
      promise.then(parts => parts.forEach(part => part.dispose()), () => {});
    }
    for (const promise of texCache.values()) {
      promise.then(tex => { tex.dispose(); tex.image.close(); }, () => {});
    }
    viewport?.dispose();
  };
}
