// src/chains.ts
import { defineChain } from "viem";

// 导出一个“localhost”链，给 RainbowKit / wagmi 用
export const localhost = defineChain({
  id: 31337,
  name: "Localhost Hardhat",
  network: "hardhat",
  nativeCurrency: {
    name: "Hardhat ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545/"],
    },
    public: {
      http: ["http://127.0.0.1:8545/"],
    },
  },
});

export default localhost;