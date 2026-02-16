import type { Experiment } from "~/types";
import gradientDither from "./gradient-dither";

const experiments: Record<string, Experiment> = {
  "gradient-dither": gradientDither,
};

export default experiments;
