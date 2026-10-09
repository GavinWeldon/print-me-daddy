import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite builds three separate pieces:
//  - main:     the behind-the-scenes Node.js part (windows, tray, hotkey, settings)
//  - preload:  a tiny safe bridge between the two
//  - renderer: the React chat screen you actually see
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()]
  }
})
