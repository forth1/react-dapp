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

import { sepoliaChain } from "./chains";
import App from "./App";
import "./index.css";

const config = getDefaultConfig({
  appName: "Lesson 22 Bank DApp (Sepolia)",
  projectId: "demo-project-id", // 本地开发，随便写
  chains: [sepoliaChain],
  ssr: false,
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/* 不用再手动传 chains，默认用上面 config 里的 */}
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);