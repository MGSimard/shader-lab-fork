import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ["~/assets/css/app.css"],
  compatibilityDate: "latest",
  ssr: false,
  future: { compatibilityVersion: 4 },
  fonts: { experimental: { disableLocalFallbacks: true } },
  vite: {
    plugins: [tailwindcss(), glsl()],
  },
  app: {
    head: {
      title: "Shader Lab",
      meta: [
        { name: "description", content: "Shader experiments playground" },
      ],
    },
  },
  modules: ["@nuxt/fonts"],
});
