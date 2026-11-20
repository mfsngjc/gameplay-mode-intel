import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGunViewport, makeOption } from './gun-model-stage.js?v=20261116-mw4-viewhands';

const variantsExtension = 'KHR_materials_variants';

function readGlb(buffer) {
  const header = new DataView(buffer);
  if (buffer.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== buffer.byteLength ||
      header.getUint32(16, true) !== 0x4e4f534a || header.getUint32(12, true) > buffer.byteLength - 20) {
    throw new Error('请选择有效的 GLB 2.0 文件。');
  }
  const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, header.getUint32(12, true))));
  if ([...manifest.buffers || [], ...manifest.images || []].some(item => item.uri && !item.uri.startsWith('data:'))) {
    throw new Error('请将贴图和网格一并嵌入 GLB。');
  }
  const manager = new THREE.LoadingManager().setURLModifier(url => {
    if (/^(blob|data):/.test(url)) return url;
    throw new Error('GLB 包含外部资源。');
  });
  const loader = new GLTFLoader(manager);
  loader.register(() => ({ name: variantsExtension }));
  return loader.parseAsync(buffer, '');
}

function addResources(resources, material) {
  for (const entry of Array.isArray(material) ? material : [material]) {
    resources.add(entry);
    for (const value of Object.values(entry)) {
      if (value?.isTexture) resources.add(value);
    }
  }
}

function disposeModel(model) {
  model.scene.removeFromParent();
  const images = new Set();
  for (const resource of model.resources) {
    if (resource.isTexture && resource.image?.close) images.add(resource.image);
    resource.dispose();
  }
  for (const image of images) image.close();
}

async function prepareModel(gltf, weaponId) {
  const { scene, parser, animations } = gltf;
  const { json, associations } = parser;
  const config = json.asset.extras?.gunsmith || {};
  const variants = json.extensions?.[variantsExtension]?.variants || [];
  const nodes = new Map();
  const originalVisibility = new Map();
  const meshes = [];
  const resources = new Set();
  scene.traverse(node => {
    const association = associations.get(node);
    const name = json.nodes?.[association?.nodes]?.name;
    if (name) nodes.set(name, nodes.has(name) ? null : node);
    if (node.isMesh) {
      meshes.push(node);
      resources.add(node.geometry);
      addResources(resources, node.material);
      if (node.skeleton) resources.add(node.skeleton);
    }
  });
  const model = { scene, resources };
  try {
    if (!meshes.length) throw new Error('文件内没有可显示的网格。');
    if (config.weaponId && config.weaponId !== weaponId) throw new Error('此 GLB 属于另一件武器。');

    function resolveNodes(names = []) {
      return names.map(name => {
        const node = nodes.get(name);
        if (!node) throw new Error('找不到唯一的配件或外观节点：' + name);
        originalVisibility.set(node, node.visible);
        return node;
      });
    }

    const slots = (config.slots || []).map(slot => {
      const options = slot.options.map(option => ({ ...option, nodes: resolveNodes(option.nodes) }));
      const defaultId = slot.default ?? options[0]?.id;
      if (!options.some(option => option.id === defaultId)) throw new Error('配件槽缺少有效的默认项：' + slot.name);
      return { ...slot, options, defaultId };
    });
    const blueprints = (config.blueprints || []).map(preset => {
      const variant = preset.variant == null ? -1 : variants.findIndex(entry => entry.name === preset.variant);
      if (preset.variant != null && variant < 0) throw new Error('蓝图引用了未知材质：' + preset.variant);
      for (const [id, choice] of Object.entries(preset.parts || {})) {
        if (!slots.find(slot => slot.id === id)?.options.some(option => option.id === choice)) {
          throw new Error('蓝图引用了未知配件：' + id);
        }
      }
      return { ...preset, variant, show: resolveNodes(preset.show), hide: resolveNodes(preset.hide) };
    });
    const surfaces = await Promise.allSettled(meshes.map(async mesh => {
      const original = mesh.material;
      const association = associations.get(mesh);
      const primitive = json.meshes?.[association?.meshes]?.primitives?.[association?.primitives];
      const layers = new Map();
      for (const mapping of primitive?.extensions?.[variantsExtension]?.mappings || []) {
        const material = await parser.getDependency('material', mapping.material);
        addResources(resources, material);
        mesh.material = material;
        parser.assignFinalMaterial(mesh);
        addResources(resources, mesh.material);
        for (const variant of mapping.variants) layers.set(variant, mesh.material);
      }
      mesh.material = original;
      return { mesh, original, layers };
    }));
    const failed = surfaces.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    const firstPersonCamera = nodes.get(config.firstPersonCamera);
    if (firstPersonCamera && animations.length) {
      // The pose can move a viewmodel outside the mesh's original culling sphere.
      for (const mesh of meshes) if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
    }
    const clipAudio = new Map();
    for (const [name, index] of Object.entries(config.animationAudio || {})) {
      if (!Number.isInteger(index) || !json.bufferViews?.[index]) continue;
      const bytes = await parser.getDependency('bufferView', index);
      clipAudio.set(name, new Blob([bytes], { type: 'audio/ogg' }));
    }
    return Object.assign(model, {
      slots, blueprints, variants, originalVisibility,
      surfaces: surfaces.map(result => result.value),
      clips: animations.filter(clip => clip.duration > 0 && clip.tracks.length),
      labels: config.animationLabels || {},
      clipGroups: config.animationGroups || {},
      clipAudio,
      firstPersonCamera
    });
  } catch (error) {
    disposeModel(model);
    throw error;
  }
}

export function mountGunGlbViewer(host, weaponId) {
  const controller = new AbortController();
  const { signal } = controller;
  const get = selector => host.querySelector(selector);
  const listen = (target, event, callback) => target?.addEventListener(event, callback, { signal });
  const stage = get('.gun-model-stage');
  const status = get('[role="status"]');
  const appearance = get('.gun-model-appearance').parentElement;
  const blueprint = get('.gun-blueprint-select');
  const camo = get('.gun-skin-select');
  const parts = get('.gun-attachment-fields');
  const motion = get('.gun-motion');
  const clipSelect = get('.gun-motion-clip');
  const play = get('.gun-motion-play');
  const loop = get('.gun-motion-loop');
  const speed = get('.gun-motion-speed');
  const sound = get('.gun-motion-sound');
  const seek = get('.gun-motion-seek');
  const time = get('.gun-motion-time');
  const footnote = get('.gun-model-footnote');
  const resetView = get('.gun-model-recenter');
  const switchView = get('.gun-model-view');
  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = .75;
  let audioUrl;
  let model;
  let viewport;
  let mixer;
  let action;
  let frame;
  let previousTime;
  let motionFramed;
  let firstPerson;
  let revision = 0;

  function announce(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function applyAppearance() {
    const preset = model.blueprints[Number(blueprint.value)];
    const paint = Number(camo.value);
    for (const { mesh, original, layers } of model.surfaces) {
      mesh.material = layers.get(paint) || layers.get(preset?.variant) || original;
    }
    for (const [node, visible] of model.originalVisibility) node.visible = visible;
    for (const node of preset?.hide || []) node.visible = false;
    for (const node of preset?.show || []) node.visible = true;
    for (const [index, slot] of model.slots.entries()) {
      const selected = parts.children[index].querySelector('select').value;
      for (const option of slot.options) {
        if (option.id !== selected) for (const node of option.nodes) node.visible = false;
      }
      for (const node of slot.options.find(option => option.id === selected).nodes) node.visible = true;
    }
    viewport.draw();
  }

  function applyBlueprint() {
    const preset = model.blueprints[Number(blueprint.value)];
    camo.value = '-1';
    for (const [index, slot] of model.slots.entries()) {
      parts.children[index].querySelector('select').value = preset?.parts?.[slot.id] ?? slot.defaultId;
    }
    applyAppearance();
  }

  function updateTime() {
    const duration = action.getClip().duration;
    seek.value = action.time;
    time.textContent = action.time.toFixed(2) + ' / ' + duration.toFixed(2) + ' 秒';
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = undefined;
    if (action) action.paused = true;
    audio.pause();
    play.textContent = '播放';
  }

  function tick(now) {
    const elapsed = Math.max(0, Math.min(.1, (now - previousTime) / 1000));
    const lastTime = action.time;
    mixer.update(elapsed * Number(speed.value));
    previousTime = now;
    if (audioUrl && sound.checked) {
      if (action.time < lastTime) {
        audio.currentTime = action.time;
        playAudio();
      } else if (!audio.seeking && !audio.paused && !audio.ended && Math.abs(audio.currentTime - action.time) > .16) {
        audio.currentTime = action.time;
      }
    }
    updateTime();
    viewport.draw();
    if (action.paused) pause();
    else frame = requestAnimationFrame(tick);
  }

  function useAudio(blob) {
    audio.pause();
    if (audioUrl) {
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(audioUrl);
      audioUrl = undefined;
    }
    sound.closest('label').hidden = !blob;
    if (blob) {
      audioUrl = URL.createObjectURL(blob);
      audio.src = audioUrl;
    }
  }

  function playAudio() {
    if (!audioUrl || !sound.checked) return;
    audio.playbackRate = Number(speed.value);
    audio.currentTime = action.time;
    audio.play().catch(() => {});
  }

  function selectClip() {
    pause();
    motionFramed = false;
    mixer.stopAllAction();
    const clip = model.clips[Number(clipSelect.value)];
    useAudio(model.clipAudio.get(clip.name));
    action = mixer.clipAction(clip).reset();
    action.clampWhenFinished = true;
    action.setLoop(loop.checked ? THREE.LoopRepeat : THREE.LoopOnce, loop.checked ? Infinity : 1);
    action.play();
    action.paused = true;
    seek.max = clip.duration;
    mixer.update(0);
    updateTime();
    viewport.draw();
  }

  function clearModel() {
    pause();
    useAudio();
    viewport?.setViewpoint(null);
    mixer?.stopAllAction();
    if (model) {
      mixer?.uncacheRoot(model.scene);
      disposeModel(model);
    }
    action = undefined;
  }

  function frameMotion() {
    if (!firstPerson && !motionFramed) {
      motionFramed = true;
      viewport.fit(model.scene, true);
    }
  }

  function setView(first) {
    firstPerson = first && Boolean(model.firstPersonCamera);
    switchView.hidden = !model.firstPersonCamera;
    switchView.textContent = firstPerson ? '自由旋转' : '第一人称';
    resetView.hidden = firstPerson;
    viewport.setViewpoint(firstPerson ? model.firstPersonCamera : null);
    if (!firstPerson) viewport.fit(model.scene);
  }

  async function load(read, label) {
    const ticket = ++revision;
    announce('正在读取模型与动画…');
    let pending;
    try {
      const buffer = await read();
      if (signal.aborted || ticket !== revision) return;
      pending = await prepareModel(await readGlb(buffer), weaponId);
      if (signal.aborted || ticket !== revision) return;
      viewport ??= createGunViewport(stage);
      clearModel();
      model = pending;
      pending = undefined;
      viewport.scene.add(model.scene);
      blueprint.replaceChildren(makeOption('-1', '默认外观'),
        ...model.blueprints.map((preset, index) => makeOption(index, preset.name)));
      camo.replaceChildren(makeOption('-1', '随蓝图'),
        ...model.variants.map((variant, index) => makeOption(index, variant.name)));
      parts.replaceChildren(...model.slots.map(slot => {
        const label = document.createElement('label');
        const select = document.createElement('select');
        select.name = slot.id;
        select.setAttribute('aria-label', slot.name);
        select.replaceChildren(...slot.options.map(option => makeOption(option.id, option.name)));
        label.append(slot.name, select);
        return label;
      }));
      blueprint.parentElement.hidden = model.blueprints.length === 0;
      camo.parentElement.hidden = model.variants.length === 0;
      appearance.hidden = !model.blueprints.length && !model.variants.length && !model.slots.length;
      applyBlueprint();
      mixer = new THREE.AnimationMixer(model.scene);
      const groups = new Map();
      clipSelect.replaceChildren();
      for (const [index, clip] of model.clips.entries()) {
        const option = makeOption(index, (Object.hasOwn(model.labels, clip.name) && model.labels[clip.name]) || clip.name || '片段 ' + (index + 1));
        const label = Object.hasOwn(model.clipGroups, clip.name) && model.clipGroups[clip.name];
        if (label && !groups.has(label)) {
          const group = document.createElement('optgroup');
          group.label = label;
          groups.set(label, group);
          clipSelect.append(group);
        }
        (groups.get(label) || clipSelect).append(option);
      }
      motion.hidden = model.clips.length === 0;
      if (model.clips.length) selectClip();
      footnote.textContent = label + (model.clips.length ? ' · ' + model.clips.length + ' 段动画' : ' · 文件内无可播放的动画');
      footnote.hidden = false;
      host.classList.add('has-model');
      setView(true);
      announce('');
    } catch (error) {
      if (!signal.aborted && ticket === revision) announce(error.message || 'GLB 加载失败。');
    } finally {
      if (pending) disposeModel(pending);
    }
  }

  const tools = host.parentElement;
  const fileInput = tools.querySelector('.gun-local-file');
  const localButton = tools.querySelector('.gun-local-read');
  fileInput.disabled = false;
  if (localButton) localButton.disabled = false;
  listen(fileInput, 'change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) load(() => file.arrayBuffer(), file.name);
  });
  listen(localButton, 'click', () => {
    const filename = weaponId + '.glb';
    load(async () => {
      const response = await fetch('local-only/cod-mw4/' + encodeURIComponent(filename), { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('本地模型库没有找到 ' + filename + '。');
      return response.arrayBuffer();
    }, filename);
  });
  listen(blueprint, 'change', applyBlueprint);
  listen(camo, 'change', applyAppearance);
  listen(parts, 'change', applyAppearance);
  listen(get('.gun-model-reset'), 'click', () => {
    blueprint.value = '-1';
    applyBlueprint();
  });
  listen(resetView, 'click', () => viewport.fit(model.scene));
  listen(switchView, 'click', () => setView(!firstPerson));
  listen(clipSelect, 'change', selectClip);
  listen(play, 'click', () => {
    if (frame !== undefined) {
      pause();
      return;
    }
    if (action.time >= action.getClip().duration) selectClip();
    frameMotion();
    action.paused = false;
    playAudio();
    play.textContent = '暂停';
    previousTime = performance.now();
    frame = requestAnimationFrame(tick);
  });
  listen(loop, 'change', () => action.setLoop(loop.checked ? THREE.LoopRepeat : THREE.LoopOnce, loop.checked ? Infinity : 1));
  listen(speed, 'change', () => { audio.playbackRate = Number(speed.value); });
  listen(sound, 'change', () => {
    if (!sound.checked) audio.pause();
    else if (frame !== undefined) playAudio();
  });
  listen(seek, 'input', () => {
    pause();
    action.time = Number(seek.value);
    mixer.update(0);
    updateTime();
    frameMotion();
    viewport.draw();
  });
  return () => {
    controller.abort();
    clearModel();
    viewport?.dispose();
    fileInput.disabled = true;
    if (localButton) localButton.disabled = true;
    host.classList.remove('has-model');
  };
}
