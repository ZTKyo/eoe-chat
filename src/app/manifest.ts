import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "EOE Chat",
    short_name: "EOE",
    description: "自然对话优先的本地 AI 聊天应用",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f8fa",
    theme_color: "#f7f8fa",
    lang: "zh-CN",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
