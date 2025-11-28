// src/utils/getBankContract.ts
import { ethers } from "ethers";
import abiJson from "../contracts/Bank.json";
import deployment from "../contracts/deployments.json";

// 从 json 里取出 abi 和 合约地址
const ABI = (abiJson as any).abi;

// 既兼容 { Bank: { address: "0x..." } } 也兼容 { Bank: "0x..." }
const ADDRESS: string =
  (deployment as any).Bank?.address || (deployment as any).Bank;

if (!ADDRESS) {
  console.warn("⚠️ 没有在 deployments.json 里找到 Bank 合约地址");
}

// 给 window.ethereum 做个类型声明（不影响运行，只是让 TS 不报错）
declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * 返回：合约实例 + provider + signer
 * 并且在这里统一调用 eth_requestAccounts，保证钱包真的授权了当前网站
 */
export async function getBankContract() {
  if (!window.ethereum) {
    throw new Error("请先安装 MetaMask / OKX / Binance 等浏览器钱包插件");
  }

  // 用浏览器钱包作为 provider（MetaMask 等）
  const provider = new ethers.providers.Web3Provider(window.ethereum, "any");

  // 🔴 请求账号授权
  await provider.send("eth_requestAccounts", []);

  const signer = provider.getSigner();
  const contract = new ethers.Contract(ADDRESS, ABI, signer);

  return { contract, provider, signer };
}