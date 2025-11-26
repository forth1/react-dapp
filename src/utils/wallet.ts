// src/utils/wallet.ts

export async function switchOrAddHardhat() {
  const anyWindow = window as any;
  const provider = anyWindow.ethereum;

  if (!provider) {
    alert("请先安装 MetaMask / OKX / Binance 等浏览器钱包插件");
    return;
  }

  // Hardhat 本地网络配置
  const hardhatChain = {
    chainId: "0x7a69", // 31337 的 16 进制
    chainName: "Localhost Hardhat",
    rpcUrls: ["http://127.0.0.1:8545/"],
    nativeCurrency: {
      name: "Hardhat ETH",
      symbol: "ETH",
      decimals: 18,
    },
  };

  try {
    // 先尝试直接切换网络
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hardhatChain.chainId }],
    });
    console.log("已切换到 Hardhat 网络");
  } catch (switchError: any) {
    console.warn("切换 Hardhat 网络失败，尝试添加网络", switchError);

    // 一些钱包的错误码：4902 = 该网络还没添加
    const msg = String(switchError?.message || "");
    const needAdd =
      switchError?.code === 4902 ||
      msg.includes("Unrecognized chain ID") ||
      msg.includes("Chain 31337 not added");

    if (!needAdd) {
      alert("切换 Hardhat 网络失败，请看控制台日志");
      return;
    }

    // 尝试添加网络
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [hardhatChain],
      });
      console.log("成功添加 Hardhat 网络");

      // 添加成功后再切换过去
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hardhatChain.chainId }],
      });
    } catch (addError) {
      console.error("添加 Hardhat 网络失败：", addError);
      alert("添加 Hardhat 网络失败，请打开浏览器控制台查看详细错误");
    }
  }
}