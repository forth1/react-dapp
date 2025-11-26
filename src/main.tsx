// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "@rainbow-me/rainbowkit/styles.css";

import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { localhost } from "./chains";  // ✅ 这里就能正确拿到 localhost 了
import App from "./App";
import "./index.css";

// 本地开发，projectId 随便写一个字符串即可
const config = getDefaultConfig({
  appName: "Lesson 17 Bank DApp",
  projectId: "demo-project-id",
  chains: [localhost],
  ssr: false,
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);