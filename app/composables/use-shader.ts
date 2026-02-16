import * as THREE from "three";
import type { Experiment, GradientStop, UniformValue } from "~/types";

type UniformValues = Record<string, UniformValue>;

const GRADIENT_RESOLUTION = 256;

const DEFAULT_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function hexToVec3(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function createGradientTexture(stops: GradientStop[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = GRADIENT_RESOLUTION;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const gradient = ctx.createLinearGradient(0, 0, GRADIENT_RESOLUTION, 0);
  for (const stop of sorted) {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.position)), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT_RESOLUTION, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function updateGradientTexture(texture: THREE.CanvasTexture, stops: GradientStop[]) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const gradient = ctx.createLinearGradient(0, 0, GRADIENT_RESOLUTION, 0);
  for (const stop of sorted) {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.position)), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT_RESOLUTION, 1);
  texture.needsUpdate = true;
}

function buildThreeUniforms(experiment: Experiment, values: UniformValues) {
  const uniforms: Record<string, { value: unknown }> = {
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  };

  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      const val = values[def.name] ?? def.default;

      switch (def.type) {
        case "float":
        case "int":
          uniforms[def.name] = { value: val as number };
          break;
        case "bool":
          uniforms[def.name] = { value: val as boolean };
          break;
        case "color":
          uniforms[def.name] = { value: hexToVec3(val as string) };
          break;
        case "vec2": {
          const v = val as [number, number];
          uniforms[def.name] = { value: new THREE.Vector2(v[0], v[1]) };
          break;
        }
        case "gradient": {
          const stops = val as GradientStop[];
          uniforms[def.name] = { value: createGradientTexture(stops) };
          break;
        }
      }
    }
  }

  return uniforms;
}

export function useShader(
  canvasRef: Ref<HTMLCanvasElement | null>,
  experiment: Experiment,
) {
  const values = reactive<UniformValues>({});
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let uniforms: Record<string, { value: unknown }> = {};
  let animationId: number | null = null;

  // Initialize default values from experiment definition
  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      if (def.type === "gradient") {
        // Deep clone gradient stops so each instance is independent
        values[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
      } else {
        values[def.name] = def.default;
      }
    }
  }

  function init() {
    const canvas = canvasRef.value;
    if (!canvas) return;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setClearColor(0x0a0a0a);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene = new THREE.Scene();

    uniforms = buildThreeUniforms(experiment, values);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: experiment.vertexShader ?? DEFAULT_VERTEX_SHADER,
      fragmentShader: experiment.fragmentShader,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    animate();
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;

    uniforms.u_time.value = performance.now() / 1000;
    renderer.render(scene, camera);
  }

  function resize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value = new THREE.Vector2(
      window.innerWidth,
      window.innerHeight,
    );
  }

  function syncUniforms() {
    if (!uniforms.u_time) return; // not initialized yet

    for (const group of experiment.groups) {
      for (const def of group.uniforms) {
        const val = values[def.name];
        if (val === undefined || !uniforms[def.name]) continue;

        switch (def.type) {
          case "float":
          case "int":
            uniforms[def.name].value = val as number;
            break;
          case "bool":
            uniforms[def.name].value = val as boolean;
            break;
          case "color":
            (uniforms[def.name].value as THREE.Color).set(val as string);
            break;
          case "vec2": {
            const v = val as [number, number];
            (uniforms[def.name].value as THREE.Vector2).set(v[0], v[1]);
            break;
          }
          case "gradient": {
            const stops = val as GradientStop[];
            const texture = uniforms[def.name].value as THREE.CanvasTexture;
            updateGradientTexture(texture, stops);
            break;
          }
        }
      }
    }
  }

  function destroy() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    // Dispose gradient textures
    for (const group of experiment.groups) {
      for (const def of group.uniforms) {
        if (def.type === "gradient" && uniforms[def.name]) {
          (uniforms[def.name].value as THREE.CanvasTexture).dispose();
        }
      }
    }

    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
  }

  // Watch for value changes and sync to Three.js uniforms
  watch(values, syncUniforms, { deep: true });

  onMounted(() => {
    init();
    window.addEventListener("resize", resize);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", resize);
    destroy();
  });

  return {
    values,
  };
}
