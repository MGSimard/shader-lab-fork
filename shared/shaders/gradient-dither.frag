#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

uniform float freq;
uniform float sharpness;
uniform float amplitude;
uniform float waveWidthMod;
uniform float offsetX;
uniform float speed;

uniform float localWarpIntensity;
uniform float localWarpFreqX;
uniform float localWarpFreqY;
uniform vec2 warpDirection;

uniform float ditherLevels;
uniform float ditherScale;

uniform float grainIntensity;
uniform float grainSpeed;

uniform float vignetteIntensity;
uniform float vignetteRadius;

// Feature enable toggles (1.0 = on, 0.0 = off)
uniform float u_enableWave;
uniform float u_enableWarp;
uniform float u_enableGradient;
uniform float u_enableDither;
uniform float u_enableGrain;
uniform float u_enableVignette;

// Gradient texture (1D ramp, generated on CPU)
uniform sampler2D u_gradient;

// Export scale factor (1.0 during normal rendering, >1.0 during high-res capture)
uniform float u_scale;

// --- Fast tanh approximation
float fastTanh(float x) {
    return clamp(x * (27.0 + x * x) / (27.0 + 9.0 * x * x), -1.0, 1.0);
}

// --- Square wave with variable width lobes
float modulatedSquareWave(float x, float freq, float sharpness, float widthMod) {
    float mod = 1.0 + sin(x * freq * 0.5) * widthMod;
    mod = clamp(mod, 0.3, 2.0);
    return fastTanh(sin(x * freq * mod) * sharpness);
}

// --- Local sine distortion
vec2 localWarp(vec2 uv, float intensity, float freqX, float freqY) {
    float warpX = (freqX > 0.0) ? sin(uv.y * freqX) * intensity * 0.5 : 0.0;
    float warpY = (freqY > 0.0) ? sin(uv.x * freqY) * intensity * 0.4 : 0.0;
    uv.x += warpX;
    uv.y += warpY;
    return uv;
}

// --- Hash function by David Hoskins (non-sine)
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// --- Bayer dithering
float bayer4x4(vec2 coord) {
    mat4 bayerMatrix = mat4(
        0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
        12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
        3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
        15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
    );
    int x = int(mod(coord.x, 4.0));
    int y = int(mod(coord.y, 4.0));
    return bayerMatrix[y][x];
}

vec3 ditherColor(vec3 color, vec2 coord, float levels, float scale) {
    vec2 ditherCoord = floor(coord / scale);
    float threshold = bayer4x4(ditherCoord);
    return floor(color * levels + threshold) / levels;
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    // Quantize to dither block (scale with u_scale so export matches screen)
    float scale = ditherScale * u_scale;
    vec2 ditherBlockCoord = floor(fragCoord / scale) * scale + scale * 0.5;

    // Use dither block center for all calculations
    vec2 blockUV = ditherBlockCoord / u_resolution;
    blockUV = blockUV * 2.0 - 1.0;
    blockUV.x *= u_resolution.x / u_resolution.y;
    blockUV.x += offsetX + (u_enableWave > 0.5 ? (sin(u_time * speed * 0.15) * 0.5 + cos(u_time * speed * 0.08) * 0.3) : 0.0);

    // Time-based animation
    float animatedWarpIntensity = localWarpIntensity + 0.12 * sin(u_time * speed * 0.9);
    float animatedWaveWidth     = pow(waveWidthMod, u_time * speed * 0.1) + 0.25 * sin(u_time * speed * 0.3 + 3.14);

    // Square wave warp (only when enabled)
    vec2 warpedUV = blockUV;
    if (u_enableWave > 0.5) {
        float angle = atan(warpDirection.y, warpDirection.x) + sin(u_time * speed * 0.1) * 1.57;
        vec2 dir = vec2(cos(angle), sin(angle));
        float diag = dot(blockUV, dir);
        float wave = modulatedSquareWave(diag, freq, sharpness, animatedWaveWidth);
        float animatedAmplitude = amplitude * (1.5 + 0.4 * sin(u_time * speed * 0.13));
        warpedUV = blockUV + dir * wave * animatedAmplitude;
    }

    // Local warping (only when enabled)
    if (u_enableWarp > 0.5) {
        warpedUV = localWarp(warpedUV, animatedWarpIntensity, localWarpFreqX, localWarpFreqY);
    }

    // Sample gradient texture: map warpedUV.y from [-1.5, 1.5] to [0, 1]
    vec3 color;
    if (u_enableGradient > 0.5) {
        float gradientT = clamp(warpedUV.y * -0.33 + 0.5, 0.0, 1.0);
        color = texture2D(u_gradient, vec2(gradientT, 0.5)).rgb;
    } else {
        color = vec3(0.5);  // neutral gray when gradient disabled
    }

    // Grain: use dither block coord for blocky grain (only when enabled)
    if (u_enableGrain > 0.5) {
        float grainSeed = fract(u_time * grainSpeed);
        float grain = hash12(ditherBlockCoord + grainSeed);
        grain = grain * 2.0 - 1.0;
        grain *= grainIntensity;
        color += grain;
    }

    // Vignette: use dither block coord for blocky feathering (only when enabled)
    if (u_enableVignette > 0.5) {
        vec2 normUV = ditherBlockCoord / u_resolution;
        vec2 feather = smoothstep(0.0, vignetteRadius, normUV) * smoothstep(0.0, vignetteRadius, 1.0 - normUV);
        float edgeMask = feather.x * feather.y;
        color = mix(color, color * edgeMask, vignetteIntensity);
    }

    // Bayer dithering: only this is per-pixel (only when enabled)
    if (u_enableDither > 0.5) {
        color = ditherColor(color, fragCoord, ditherLevels, ditherScale * u_scale);
    }

    gl_FragColor = vec4(color, 1.0);
}
