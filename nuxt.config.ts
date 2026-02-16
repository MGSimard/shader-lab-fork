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
      link: [
        { rel: "icon", type: "image/png", href: "/favicon.png" },
      ],
      meta: [
        { name: "description", content: "Shader experiments playground" },
        { property: "og:title", content: "Shader Lab" },
        { property: "og:description", content: "Shader experiments playground" },
        { property: "og:image", content: "https://shader.zeitwork.com/og-image.png" },
        { property: "og:url", content: "https://shader.zeitwork.com" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Shader Lab" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Shader Lab" },
        { name: "twitter:description", content: "Shader experiments playground" },
        { name: "twitter:image", content: "https://shader.zeitwork.com/og-image.png" },
      ],
    },
  },
  modules: ["@nuxt/fonts"],
});
