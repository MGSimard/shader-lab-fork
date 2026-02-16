import { createCanvas, loadImage } from "@napi-rs/canvas";
import experiments from "#shared/experiments";
import type { GradientStop, UniformValue } from "#shared/types";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const GRADIENT_RESOLUTION = 256;

const DEFAULT_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// --- URL state decoding (mirrors use-url-state.ts logic) ---

function decodeState(encoded: string): Record<string, UniformValue> | null {
  try {
    const json = atob(encoded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function validateValue(raw: unknown, type: string): UniformValue | null {
  switch (type) {
    case "float":
    case "int":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    case "bool":
      return typeof raw === "boolean" ? raw : null;
    case "color":
      return typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? raw : null;
    case "vec2":
      return Array.isArray(raw) &&
        raw.length === 2 &&
        typeof raw[0] === "number" &&
        typeof raw[1] === "number"
        ? (raw as [number, number])
        : null;
    case "gradient": {
      if (!Array.isArray(raw) || raw.length === 0) return null;
      const stops = raw.filter(
        (s): s is GradientStop =>
          typeof s === "object" &&
          s !== null &&
          typeof s.color === "string" &&
          /^#[0-9a-f]{6}$/i.test(s.color) &&
          typeof s.position === "number" &&
          s.position >= 0 &&
          s.position <= 1,
      );
      return stops.length >= 2 ? stops : null;
    }
    default:
      return null;
  }
}

// --- Gradient texture creation for server-side ---

function createGradientData(stops: GradientStop[]): Uint8Array {
  const canvas = createCanvas(GRADIENT_RESOLUTION, 1);
  const ctx = canvas.getContext("2d");

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const gradient = ctx.createLinearGradient(0, 0, GRADIENT_RESOLUTION, 0);
  for (const stop of sorted) {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.position)), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT_RESOLUTION, 1);

  const imageData = ctx.getImageData(0, 0, GRADIENT_RESOLUTION, 1);
  return new Uint8Array(imageData.data);
}

function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

// --- Headless rendering ---

async function renderShader(
  experimentId: string,
  stateParam?: string,
): Promise<Uint8Array | null> {
  const experiment = experiments[experimentId];
  if (!experiment) return null;

  // Lazy-import native modules (gl requires native bindings that may not be available locally)
  let createGL: any;
  let THREE: any;
  try {
    // Use createRequire for native modules — dynamic import() doesn't resolve
    // node_modules correctly from Nitro's bundled server chunks.
    // Point createRequire to .output/server/ where bun installed node_modules.
    const { createRequire } = await import("module");
    const { join } = await import("path");
    const serverPkg = join(process.cwd(), ".output", "server", "package.json");
    const require = createRequire(serverPkg);
    createGL = require("gl");
    THREE = require("three");
  } catch (e) {
    console.error("Failed to import gl/three:", e);
    return null;
  }

  // Resolve uniform values: start with defaults, override with URL state
  const values: Record<string, UniformValue> = {};
  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      if (def.type === "gradient") {
        values[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
      } else {
        values[def.name] = def.default;
      }
    }
  }

  if (stateParam) {
    const decoded = decodeState(stateParam);
    if (decoded) {
      const uniformTypes = new Map<string, string>();
      for (const group of experiment.groups) {
        for (const def of group.uniforms) {
          uniformTypes.set(def.name, def.type);
        }
      }
      for (const [key, raw] of Object.entries(decoded)) {
        const type = uniformTypes.get(key);
        if (!type) continue;
        const validated = validateValue(raw, type);
        if (validated !== null) {
          values[key] = validated;
        }
      }
    }
  }

  // Create headless GL context
  const glContext = createGL(OG_WIDTH, OG_HEIGHT, { preserveDrawingBuffer: true });
  if (!glContext) return null;

  // Minimal canvas shim for Three.js
  const canvasShim = {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    style: {} as CSSStyleDeclaration,
    getContext: () => glContext,
    addEventListener: () => {},
    removeEventListener: () => {},
    clientWidth: OG_WIDTH,
    clientHeight: OG_HEIGHT,
  };

  try {
    // Create Three.js renderer with the headless GL context
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasShim as unknown as HTMLCanvasElement,
      context: glContext as unknown as WebGLRenderingContext,
      antialias: false,
    });
    renderer.setSize(OG_WIDTH, OG_HEIGHT, false);
    renderer.setClearColor(0x0a0a0a);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();

    // Build uniforms
    const uniforms: Record<string, { value: unknown }> = {
      u_time: { value: 0.5 },
      u_resolution: { value: new THREE.Vector2(OG_WIDTH, OG_HEIGHT) },
      u_scale: { value: 1.0 },
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
            uniforms[def.name] = { value: new THREE.Color(val as string) };
            break;
          case "vec2": {
            const v = val as [number, number];
            uniforms[def.name] = { value: new THREE.Vector2(v[0], v[1]) };
            break;
          }
          case "gradient": {
            const stops = val as GradientStop[];
            const gradientData = createGradientData(stops);

            // Create a DataTexture from the gradient pixel data
            const texture = new THREE.DataTexture(
              gradientData,
              GRADIENT_RESOLUTION,
              1,
              THREE.RGBAFormat,
            );
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.needsUpdate = true;
            uniforms[def.name] = { value: texture };
            break;
          }
        }
      }
    }

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: experiment.vertexShader ?? DEFAULT_VERTEX_SHADER,
      fragmentShader: experiment.fragmentShader,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Render
    renderer.render(scene, camera);

    // Read pixels
    const pixels = new Uint8Array(OG_WIDTH * OG_HEIGHT * 4);
    glContext.readPixels(0, 0, OG_WIDTH, OG_HEIGHT, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);

    // Clean up
    geometry.dispose();
    material.dispose();
    try { renderer.dispose(); } catch { /* canvas shim may not support all cleanup methods */ }
    try { glContext.getExtension("STACKGL_destroy_context")?.destroy(); } catch { /* ignore */ }

    return pixels;
  } catch (e) {
    console.error("OG image render failed:", e);
    try { glContext.getExtension("STACKGL_destroy_context")?.destroy(); } catch { /* ignore */ }
    return null;
  }
}

// --- Composite: shader pixels + logo + text ---

async function compositeImage(pixels: Uint8Array): Promise<Buffer> {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext("2d");

  // WebGL pixels are bottom-up, we need to flip them vertically
  const imageData = ctx.createImageData(OG_WIDTH, OG_HEIGHT);
  for (let y = 0; y < OG_HEIGHT; y++) {
    const srcRow = (OG_HEIGHT - 1 - y) * OG_WIDTH * 4;
    const dstRow = y * OG_WIDTH * 4;
    for (let x = 0; x < OG_WIDTH * 4; x++) {
      imageData.data[dstRow + x] = pixels[srcRow + x];
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Load and draw Zeitwork logo (top-left)
  try {
    const storage = useStorage("assets:server");
    const logoSvg = await storage.getItemRaw("zeitwork-logo.svg");
    if (logoSvg) {
      const logo = await loadImage(logoSvg as Buffer);

      // Scale logo to ~160px wide, maintaining aspect ratio
      const logoTargetWidth = 160;
      const logoScale = logoTargetWidth / logo.width;
      const logoW = logoTargetWidth;
      const logoH = logo.height * logoScale;

      ctx.drawImage(logo, 40, 36, logoW, logoH);
    }
  } catch (e) {
    console.error("Failed to load logo:", e);
  }

  // Draw "Shader Lab" text (bottom-left)
  ctx.fillStyle = "white";
  ctx.font = "bold 56px sans-serif";
  ctx.fillText("Shader Lab", 40, OG_HEIGHT - 48);

  return canvas.toBuffer("image/png");
}

// --- Route handler ---

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = (query.id as string) || "gradient-dither";
  const s = query.s as string | undefined;

  // Render the shader
  const pixels = await renderShader(id, s);

  if (!pixels) {
    // Fallback: redirect to static OG image
    return sendRedirect(event, "/og-image.png", 302);
  }

  // Composite with logo and text
  const png = await compositeImage(pixels);

  setResponseHeader(event, "Content-Type", "image/png");
  setResponseHeader(event, "Cache-Control", "public, max-age=86400, s-maxage=86400");
  return png;
});
