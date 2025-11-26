// src/App.tsx
import { useEffect, useState } from "react";
import { ethers } from "ethers";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";

import { getBankContract } from "./utils/getBankContract";

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_HEX = "0x7a69";

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [bankBalance, setBankBalance] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  const onHardhat = isConnected && chainId === HARDHAT_CHAIN_ID;

  // Switch / Add Hardhat Network
  async function switchOrAddHardhat() {
    const anyWindow = window as any;
    if (!anyWindow.ethereum) {
      alert("Please install MetaMask / OKX Wallet / Binance Wallet first.");
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
                nativeCurrency: { name: "Hardhat ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["http://127.0.0.1:8545/"],
              },
            ],
          });
        } catch (addError) {
          console.error("Add Hardhat network failed:", addError);
          alert("Failed to add Hardhat network. Check console for details.");
        }
      } else {
        console.error("Switch Hardhat network failed:", switchError);
        alert("Failed to switch Hardhat network. Check console.");
      }
    }
  }

  // Refresh Bank Balance + Wallet Balance
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
    } catch (e: any) {
      console.error("Failed to refresh balances:", e);
      alert(`Failed to refresh: ${e?.reason || e?.message || "Check console"}`);
    } finally {
      setLoading(false);
    }
  }

  // Deposit 0.001 ETH
  async function handleDeposit() {
    if (!onHardhat) {
      alert("Please connect wallet and switch to Localhost Hardhat.");
      return;
    }

    try {
      setLoading(true);
      const { contract } = await getBankContract();
      const tx = await contract.deposit({
        value: ethers.utils.parseEther("0.001"),
      });
      await tx.wait();
      await refreshBalances();
    } catch (e: any) {
      console.error("Deposit failed:", e);
      alert(`Deposit failed: ${e?.reason || e?.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Withdraw 0.001 ETH
  async function handleWithdraw() {
    if (!onHardhat) {
      alert("Please connect wallet and switch to Localhost Hardhat.");
      return;
    }

    try {
      setLoading(true);
      const { contract } = await getBankContract();
      const tx = await contract.withdraw(ethers.utils.parseEther("0.001"));
      await tx.wait();
      await refreshBalances();
    } catch (e: any) {
      console.error("Withdraw failed:", e);
      alert(`Withdraw failed: ${e?.reason || e?.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Load balance when switching accounts or networks
  useEffect(() => {
    if (onHardhat && address) refreshBalances();
  }, [onHardhat, address]);

  // Listen for Deposit / Withdraw events
  useEffect(() => {
    if (!address || !onHardhat) return;

    let contractInstance: any;

    async function listenEvents() {
      const { contract } = await getBankContract();
      contractInstance = contract;

      contract.on("Deposit", (user: string, amount: any) => {
        if (user.toLowerCase() === address.toLowerCase()) {
          console.log("Deposit Event Received");
          refreshBalances();
        }
      });

      contract.on("Withdraw", (user: string, amount: any) => {
        if (user.toLowerCase() === address.toLowerCase()) {
          console.log("Withdraw Event Received");
          refreshBalances();
        }
      });
    }

    listenEvents();

    return () => {
      if (contractInstance) {
        contractInstance.removeAllListeners("Deposit");
        contractInstance.removeAllListeners("Withdraw");
      }
    };
  }, [address, onHardhat]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "radial-gradient(circle at top left, #e0f2fe, #f5f5f5 40%, #e0e7ff)",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "32px 32px 40px",
          borderRadius: "24px",
          backgroundColor: "rgba(255,255,255,0.9)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 700 }}>Lesson 17: Bank DApp</h1>
            <p style={{ marginTop: "8px", color: "#6b7280" }}>
              Connect wallet with RainbowKit + wagmi and interact with a local Hardhat Bank contract.
            </p >
          </div>
          <ConnectButton />
        </header>

        {/* Switch Hardhat Network */}
        <div style={{ marginBottom: "16px" }}>
          <button
            onClick={switchOrAddHardhat}
            style={{
              padding: "8px 16px",
              borderRadius: "999px",
              border: "none",
              fontSize: "13px",
              fontWeight: 500,
              backgroundColor: "#111827",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Switch / Add Hardhat Network
          </button>
        </div>

        {/* Status Bar */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor: "#f9fafb",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            {isConnected ? (
              <>
                <div>Address: <span style={{ fontFamily: "monospace" }}>{address}</span></div>
                <div style={{ marginTop: "6px" }}>
                  Network:
                  <span
                    style={{
                      marginLeft: "6px",
                      padding: "2px 8px",
                      borderRadius: "8px",
                      backgroundColor: onHardhat ? "#dcfce7" : "#fee2e2",
                      color: onHardhat ? "#166534" : "#b91c1c",
                    }}
                  >
                    {onHardhat ? "Localhost Hardhat" : "Wrong Network"}
                  </span>
                </div>
                <div style={{ marginTop: "6px" }}>Wallet Balance: {walletBalance} ETH</div>
              </>
            ) : (
              <div>Please connect your wallet first.</div>
            )}
          </div>
        </div>

        {/* Bank Balance */}
        <section>
          <div
            style={{
              marginBottom: "16px",
              padding: "16px 18px",
              borderRadius: "16px",
              backgroundColor: "#eef2ff",
            }}
          >
            <div style={{ fontSize: "13px", marginBottom: "4px" }}>Your Bank Balance</div>
            <div style={{ fontSize: "28px", fontWeight: 600 }}>{bankBalance} ETH</div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={refreshBalances}
              disabled={loading || !onHardhat}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                border: "none",
                backgroundColor: "#e5e7eb",
              }}
            >
              {loading ? "Loading..." : "Refresh Balance"}
            </button>

            <button
              onClick={handleDeposit}
              disabled={loading || !onHardhat}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg, #4f46e5, #6366f1, #ec4899)",
                color: "#fff",
              }}
            >
              Deposit 0.001 ETH
            </button>

            <button
              onClick={handleWithdraw}
              disabled={loading || !onHardhat}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                border: "none",
                backgroundColor: "#f97316",
                color: "#111827",
              }}
            >
              Withdraw 0.001 ETH
            </button>
          </div>

          {!onHardhat && isConnected && (
            <p style={{ marginTop: "12px", color: "#b91c1c" }}>
              Please switch to Localhost Hardhat before depositing or withdrawing.
            </p >
          )}
        </section>
      </div>
    </div>
  );
}

export default App;