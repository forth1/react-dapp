// src/tests/checkBalance.ts
import { ethers } from "ethers";
import { getBankContract } from "../utils/getBankContract";

async function main() {
  const { contract } = await getBankContract();

  // 把这里换成你要查余额的钱包地址（比如你自己的 sepolia 地址）
  const addr = "0x7c8Fdd3cCbd9b923f3d5A914b5D21144b7028B33";

  const bal = await contract.balances(addr);
  console.log("Balance:", ethers.utils.formatEther(bal), "ETH");
}

main().catch((err) => {
  console.error("Check balance failed:", err);
});