import type { Experiment } from "~/types";
import fragmentShader from "~/shaders/gradient-dither.frag";

export default {
  id: "gradient-dither",
  name: "Gradient Dither",
  description: "Animated dithered gradient with warp, grain, and Bayer dithering",
  fragmentShader,
  groups: [
    {
      label: "Wave",
      uniforms: [
        { name: "speed", type: "float", label: "Speed", default: 1.0, min: 0, max: 3, step: 0.01 },
        { name: "freq", type: "float", label: "Frequency", default: 3.0, min: 1, max: 20, step: 0.1 },
        { name: "sharpness", type: "float", label: "Sharpness", default: 6.7, min: 1, max: 50, step: 0.1 },
        { name: "amplitude", type: "float", label: "Amplitude", default: 0.51, min: 0, max: 5, step: 0.01 },
        { name: "waveWidthMod", type: "float", label: "Wave Width", default: 0.04, min: 0, max: 2, step: 0.01 },
        { name: "offsetX", type: "float", label: "Offset X", default: 0.0, min: -10, max: 10, step: 0.1 },
      ],
    },
    {
      label: "Warp",
      uniforms: [
        { name: "localWarpIntensity", type: "float", label: "Intensity", default: 0.4, min: 0, max: 20, step: 0.1 },
        { name: "localWarpFreqX", type: "float", label: "Freq X", default: 1.0, min: 0, max: 10, step: 0.1 },
        { name: "localWarpFreqY", type: "float", label: "Freq Y", default: 1.9, min: 0, max: 10, step: 0.1 },
        { name: "warpDirection", type: "vec2", label: "Direction", default: [1.0, -1.0], min: -2, max: 2, step: 0.1 },
      ],
    },
    {
      label: "Gradient",
      uniforms: [
        {
          name: "u_gradient",
          type: "gradient",
          label: "Gradient",
          default: [
            { color: "#000000", position: 0.0 },
            { color: "#330d03", position: 0.15 },
            { color: "#f35a0d", position: 0.35 },
            { color: "#fff2d9", position: 0.6 },
            { color: "#0f3839", position: 0.85 },
            { color: "#000000", position: 1.0 },
          ],
        },
      ],
    },
    {
      label: "Dithering",
      uniforms: [
        { name: "ditherLevels", type: "float", label: "Levels", default: 16.0, min: 2, max: 64, step: 1 },
        { name: "ditherScale", type: "float", label: "Pattern Size", default: 4.0, min: 1, max: 16, step: 0.5 },
      ],
    },
    {
      label: "Grain",
      uniforms: [
        { name: "grainIntensity", type: "float", label: "Intensity", default: 0.02, min: 0, max: 0.2, step: 0.001 },
        { name: "grainSpeed", type: "float", label: "Speed", default: 50.0, min: 0, max: 200, step: 1 },
      ],
    },
  ],
} satisfies Experiment;
