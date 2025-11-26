// src/utils/addHardhatNetwork.ts

export async function addAndSwitchToHardhat() {
  const anyWindow = window as any;

  if (!anyWindow.ethereum) {
    alert("请先安装 MetaMask / OKX / Binance 等浏览器钱包插件");
    return;
  }

  const params = {
    chainId: "0x7A69", // 31337 的 16 进制，Hardhat 默认 chainId
    chainName: "Localhost Hardhat",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: [] as string[],
  };

  try {
    // 1. 尝试直接切到 Hardhat 链
    await anyWindow.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: params.chainId }],
    });
  } catch (switchError: any) {
    // 如果钱包里还没有这个网络，就先添加网络
    if (switchError.code === 4902 || switchError?.message?.includes("Unrecognized chain ID")) {
      try {
        await anyWindow.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [params],
        });
      } catch (addError) {
        console.error("添加 Hardhat 网络失败：", addError);
        alert("添加 Hardhat 网络失败，请看控制台日志");
        return;
      }
    } else {
      console.error("切换网络失败：", switchError);
      alert("切换到 Hardhat 网络失败，请看控制台日志");
      return;
    }

    // 添加成功后再尝试切换一次
    try {
      await anyWindow.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: params.chainId }],
      });
    } catch (e) {
      console.error("添加后切换网络仍然失败：", e);
      alert("添加后切换网络仍然失败，请看控制台日志");
    }
  }
}