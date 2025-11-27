// src/App.tsx
import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";

import { getBankContract } from "./utils/getBankContract";

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_HEX = "0x7a69";

type TxType = "Deposit" | "Withdraw";

interface TxRecord {
  id: string;          // 唯一 id（用于 React key）
  type: TxType;
  amount: string;      // ETH 字符串
  timestamp: string;   // 本地时间
  txHash: string;      // 交易哈希
}

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [bankBalance, setBankBalance] = useState("0");
  const [walletBalance, setWalletBalance] = useState("0");
  const [amount, setAmount] = useState(""); // 输入框：默认空
  const [loading, setLoading] = useState(false);

  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw">("all");

  const [liveEvents, setLiveEvents] = useState(true);
  const [lastBlock, setLastBlock] = useState<number | null>(null);

  // 记录已经处理过的事件，避免重复（根据 type + txHash）
  const seenEventsRef = useRef<Set<string>>(new Set());

  const onHardhat = isConnected && chainId === HARDHAT_CHAIN_ID;

  // ---------------- 网络切换 ----------------
  async function switchOrAddHardhat() {
    const anyWindow = window as any;
    if (!anyWindow.ethereum) {
      alert("Please install MetaMask / OKX Wallet / Binance Wallet.");
      return;
    }

    try {
      await anyWindow.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902) {
        try {
          await anyWindow.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: HARDHAT_CHAIN_HEX,
                chainName: "Localhost Hardhat",
                nativeCurrency: {
                  name: "Hardhat ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["http://127.0.0.1:8545/"],
              },
            ],
          });
        } catch (addError) {
          console.error("Add Hardhat network failed:", addError);
          alert("Failed to add Hardhat network. Check console.");
        }
      } else {
        console.error("Switch Hardhat network failed:", switchError);
        alert("Failed to switch Hardhat network. Check console.");
      }
    }
  }

  // ---------------- 刷新余额 ----------------
  async function refreshBalances() {
    if (!onHardhat || !address) return;

    try {
      setLoading(true);
      const { contract, provider } = await getBankContract();

      const [bankBalRaw, walletBalRaw] = await Promise.all([
        contract.balances(address),
        provider.getBalance(address),
      ]);

      setBankBalance(ethers.utils.formatEther(bankBalRaw ?? 0));
      setWalletBalance(ethers.utils.formatEther(walletBalRaw ?? 0));
    } catch (e) {
      console.error("Failed to refresh balances:", e);
      alert("Failed to refresh balances, check console.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------- 记录交易（只在事件里调用） ----------------
  function addHistory(type: TxType, amountEth: string, txHash: string) {
    const key = `${type}-${txHash}`;
    if (seenEventsRef.current.has(key)) {
      // 已经记录过了，跳过
      return;
    }
    seenEventsRef.current.add(key);

    setTxHistory((prev) => [
      {
        id: `${key}-${Date.now()}`,
        type,
        amount: amountEth,
        timestamp: new Date().toLocaleString(),
        txHash,
      },
      ...prev,
    ]);
  }

  // ---------------- 存款 ----------------
  async function handleDeposit() {
    if (!onHardhat) {
      alert("Please connect wallet and switch to Localhost Hardhat.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);
      const { contract } = await getBankContract();
      const tx = await contract.deposit({
        value: ethers.utils.parseEther(amount),
      });
      await tx.wait();
      // 交易记录 & 余额更新交给事件监听器来做
      setAmount("");
    } catch (e: any) {
      console.error("Deposit failed:", e);
      alert(`Deposit failed: ${e?.reason || e?.message || "Check console"}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- 取款 ----------------
  async function handleWithdraw() {
    if (!onHardhat) {
      alert("Please connect wallet and switch to Localhost Hardhat.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);
      const { contract } = await getBankContract();
      const tx = await contract.withdraw(ethers.utils.parseEther(amount));
      await tx.wait();
      // 同样交给事件监听器
      setAmount("");
    } catch (e: any) {
      console.error("Withdraw failed:", e);
      alert(`Withdraw failed: ${e?.reason || e?.message || "Check console"}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- 自动刷新余额 ----------------
  useEffect(() => {
    if (onHardhat && address) {
      refreshBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHardhat, address]);

  // ---------------- 区块 + 事件 监听 ----------------
  useEffect(() => {
    if (!address || !onHardhat || !liveEvents) return;

    let contractInstance: any;
    let providerInstance: ethers.providers.Provider | null = null;

    async function setupListeners() {
      const { contract, provider } = await getBankContract();
      contractInstance = contract;
      providerInstance = provider;

      // 新区块监听
      provider.on("block", (blockNumber: number) => {
        setLastBlock(blockNumber);
        console.log("🧱 New Block:", blockNumber);
      });

      // Deposit 事件
      contract.on(
        "Deposit",
        (user: string, rawAmount: any, event: any) => {
          if (user.toLowerCase() !== address.toLowerCase()) return;
          const formatted = ethers.utils.formatEther(rawAmount);
          const txHash = event?.transactionHash ?? "unknown";
          addHistory("Deposit", formatted, txHash);
          refreshBalances();
        }
      );

      // Withdraw 事件
      contract.on(
        "Withdraw",
        (user: string, rawAmount: any, event: any) => {
          if (user.toLowerCase() !== address.toLowerCase()) return;
          const formatted = ethers.utils.formatEther(rawAmount);
          const txHash = event?.transactionHash ?? "unknown";
          addHistory("Withdraw", formatted, txHash);
          refreshBalances();
        }
      );
    }

    setupListeners();

    return () => {
      // 清理监听器
      if (providerInstance) {
        providerInstance.removeAllListeners("block");
      }
      if (contractInstance) {
        contractInstance.removeAllListeners("Deposit");
        contractInstance.removeAllListeners("Withdraw");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, onHardhat, liveEvents]);

  // ---------------- 过滤后的交易列表 ----------------
  const filteredTx = txHistory.filter((tx) => {
    if (filter === "deposit") return tx.type === "Deposit";
    if (filter === "withdraw") return tx.type === "Withdraw";
    return true;
  });

  // ---------------- UI ----------------
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 24px",
        background:
          "radial-gradient(circle at top left, #e0f2fe, #f9fafb 40%, #e0e7ff)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          gap: "24px",
        }}
      >
        {/* 左侧：主卡片 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.96)",
            borderRadius: "24px",
            padding: "24px 28px 28px",
            boxShadow:
              "0 22px 45px rgba(15,23,42,0.14), 0 0 0 1px rgba(148,163,184,0.25)",
          }}
        >
          {/* 顶部标题 + ConnectButton */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "#9ca3af",
                  marginBottom: "4px",
                }}
              >
                RainbowKit · wagmi · Hardhat
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "28px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                }}
              >
                Lesson 21 · Bank DApp
              </h1>
              <p style={{ marginTop: "6px", fontSize: "13px", color: "#6b7280" }}>
                Live events · New blocks · Transaction history.
              </p>
            </div>
            <ConnectButton />
          </header>

          {/* 网络切换 + Live toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "12px",
            }}
          >
            <button
              onClick={switchOrAddHardhat}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                backgroundColor: "#111827",
                color: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Switch / Add Hardhat Network
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "999px",
                  backgroundColor: liveEvents ? "#22c55e" : "#9ca3af",
                }}
              />
              <span>
                Live events:{" "}
                <strong style={{ color: liveEvents ? "#16a34a" : "#6b7280" }}>
                  {liveEvents ? "ON" : "OFF"}
                </strong>
              </span>
              {lastBlock && (
                <span style={{ marginLeft: 8 }}>Last block: {lastBlock}</span>
              )}
              <button
                onClick={() => setLiveEvents((v) => !v)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#f9fafb",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                {liveEvents ? "Pause" : "Resume"}
              </button>
            </div>
          </div>

          {/* 地址 / 网络 / 钱包余额 */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              backgroundColor: "#f9fafb",
              marginBottom: "18px",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            <div>
              Address:{" "}
              <span style={{ fontFamily: "monospace" }}>
                {address ?? "-"}
              </span>
            </div>
            <div>
              Network:{" "}
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: onHardhat ? "#dcfce7" : "#fee2e2",
                  color: onHardhat ? "#166534" : "#b91c1c",
                  fontSize: "12px",
                  marginLeft: 4,
                }}
              >
                {onHardhat ? "Localhost Hardhat" : "Wrong Network"}
              </span>
            </div>
            <div>
              Wallet Balance:{" "}
              <strong>{walletBalance}</strong> ETH
            </div>
          </div>

          {/* 银行余额 */}
          <section
            style={{
              marginBottom: "18px",
              padding: "18px 20px",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg, rgba(129,140,248,0.06), rgba(56,189,248,0.08))",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#4b5563",
                marginBottom: 4,
              }}
            >
              Your Bank Balance
            </div>
            <div
              style={{
                fontSize: "30px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
              }}
            >
              {bankBalance} ETH
            </div>
          </section>

          {/* 金额输入 + 按钮 */}
          <section>
            <div style={{ marginBottom: 10, fontSize: 13, color: "#4b5563" }}>
              Amount (ETH)
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <input
                type="number"
                step="0.001"
                min="0"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value;
                  // 允许空字符串，或者合法数字
                  if (v === "" || /^-?\d*\.?\d*$/.test(v)) {
                    setAmount(v);
                  }
                }}
                placeholder="Enter amount, e.g. 0.001"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                  outline: "none",
                }}
              />

              <button
                onClick={refreshBalances}
                disabled={loading || !onHardhat}
                style={{
                  padding: "10px 18px",
                  borderRadius: "999px",
                  border: "none",
                  fontSize: "14px",
                  backgroundColor: "#e5e7eb",
                  cursor:
                    loading || !onHardhat ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "…" : "Refresh"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleDeposit}
                disabled={loading || !onHardhat}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: "999px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  background:
                    "linear-gradient(135deg, #4f46e5, #6366f1, #ec4899)",
                  color: "#f9fafb",
                  cursor:
                    loading || !onHardhat ? "not-allowed" : "pointer",
                }}
              >
                Deposit
              </button>

              <button
                onClick={handleWithdraw}
                disabled={loading || !onHardhat}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: "999px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  backgroundColor: "#f97316",
                  color: "#111827",
                  cursor:
                    loading || !onHardhat ? "not-allowed" : "pointer",
                }}
              >
                Withdraw
              </button>
            </div>
          </section>
        </div>

        {/* 右侧：交易历史 */}
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.96)",
            borderRadius: "24px",
            padding: "20px 22px 22px",
            boxShadow:
              "0 22px 45px rgba(15,23,42,0.12), 0 0 0 1px rgba(148,163,184,0.25)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 10,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                }}
              >
                Transaction History
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Live updates from on-chain events (Deposit / Withdraw).
              </p>
            </div>
          </div>

          {/* 筛选标签 */}
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              padding: 2,
              borderRadius: "999px",
              backgroundColor: "#f3f4f6",
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            {[
              { key: "all", label: "All" },
              { key: "deposit", label: "Deposit" },
              { key: "withdraw", label: "Withdraw" },
            ].map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() =>
                    setFilter(tab.key as "all" | "deposit" | "withdraw")
                  }
                  style={{
                    border: "none",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    backgroundColor: active ? "#ffffff" : "transparent",
                    boxShadow: active
                      ? "0 1px 3px rgba(15,23,42,0.18)"
                      : "none",
                    color: active ? "#111827" : "#6b7280",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 列表 */}
          <div
            style={{
              marginTop: 4,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              padding: "4px 0",
              flex: 1,
              overflow: "hidden",
            }}
          >
            {filteredTx.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#9ca3af",
                }}
              >
                No transactions yet.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: "460px",
                  overflowY: "auto",
                }}
              >
                {filteredTx.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)",
                      padding: "10px 14px",
                      fontSize: 13,
                      alignItems: "baseline",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color:
                            tx.type === "Deposit" ? "#4f46e5" : "#dc2626",
                        }}
                      >
                        {tx.type} {tx.amount} ETH
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "#6b7280",
                        }}
                      >
                        {tx.timestamp}
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        fontSize: 11,
                        color: "#9ca3af",
                        fontFamily: "monospace",
                      }}
                    >
                      {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-8)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;