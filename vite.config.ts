import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import glsl from 'vite-plugin-glsl';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    glsl(),
  ],
  resolve: {
    //别名配置
    alias: [
      {
        find: "@",
        replacement: "/src",
      },
    ],
    //忽略文件名
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".vue"],
  },
})
