// src/App.tsx
import { useEffect, useState } from "react";
import { ethers } from "ethers";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";

import { getBankContract } from "./utils/getBankContract";

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_HEX = "0x7a69";

interface TxRecord {
  type: "Deposit" | "Withdraw";
  amount: string;
  timestamp: string;
}

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [bankBalance, setBankBalance] = useState("0");
  const [walletBalance, setWalletBalance] = useState("0");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);

  const onHardhat = isConnected && chainId === HARDHAT_CHAIN_ID;

  // ============================
  // Switch Hardhat Network
  // ============================
  async function switchOrAddHardhat() {
    const anyWindow = window as any;

    try {
      await anyWindow.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902) {
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
      }
    }
  }

  // ============================
  // Refresh balance
  // ============================
  async function refreshBalances() {
    if (!address || !onHardhat) return;

    setLoading(true);
    const { contract, provider } = await getBankContract();

    const [bankRaw, walletRaw] = await Promise.all([
      contract.balances(address),
      provider.getBalance(address),
    ]);

    setBankBalance(ethers.utils.formatEther(bankRaw));
    setWalletBalance(ethers.utils.formatEther(walletRaw));
    setLoading(false);
  }

  // ============================
  // Add transaction history
  // ============================
  function addHistory(type: "Deposit" | "Withdraw", amt: string) {
    setTxHistory((prev) => [
      {
        type,
        amount: amt,
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);
  }

  // ============================
  // Deposit
  // ============================
  async function handleDeposit() {
    if (!amount || Number(amount) <= 0) return alert("Enter valid amount");

    setLoading(true);
    const { contract } = await getBankContract();

    const tx = await contract.deposit({
      value: ethers.utils.parseEther(amount),
    });

    await tx.wait();
    addHistory("Deposit", amount);
    setAmount("");
    refreshBalances();
    setLoading(false);
  }

  // ============================
  // Withdraw
  // ============================
  async function handleWithdraw() {
    if (!amount || Number(amount) <= 0) return alert("Enter valid amount");

    setLoading(true);
    const { contract } = await getBankContract();

    const tx = await contract.withdraw(ethers.utils.parseEther(amount));

    await tx.wait();
    addHistory("Withdraw", amount);
    setAmount("");
    refreshBalances();
    setLoading(false);
  }

  // Auto-refresh
  useEffect(() => {
    if (address && onHardhat) refreshBalances();
  }, [address, onHardhat]);

  // ============================
  // Listen contract events
  // ============================
  useEffect(() => {
    if (!address || !onHardhat) return;
    let instance: any;

    async function listen() {
      const { contract } = await getBankContract();
      instance = contract;

      contract.on("Deposit", (user, amt) => {
        if (user.toLowerCase() === address.toLowerCase()) {
          const val = ethers.utils.formatEther(amt);
          addHistory("Deposit", val);
          refreshBalances();
        }
      });

      contract.on("Withdraw", (user, amt) => {
        if (user.toLowerCase() === address.toLowerCase()) {
          const val = ethers.utils.formatEther(amt);
          addHistory("Withdraw", val);
          refreshBalances();
        }
      });
    }

    listen();
    return () => instance?.removeAllListeners();
  }, [address, onHardhat]);

  // ============================
  // Main UI
  // ============================
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.title}>Lesson 17: Bank DApp</h1>
          <ConnectButton />
        </header>

        <button onClick={switchOrAddHardhat} style={styles.switchBtn}>
          Switch / Add Hardhat Network
        </button>

        {/* Status Section */}
        <section style={styles.statusBox}>
          <p><strong>Address:</strong> {address || "-"}</p >

          <p>
            <strong>Network:</strong>{" "}
            <span style={{ color: onHardhat ? "green" : "red", fontWeight: 600 }}>
              {onHardhat ? "Localhost Hardhat" : "Wrong Network"}
            </span>
          </p >

          <p><strong>Wallet Balance:</strong> {walletBalance} ETH</p >
        </section>

        {/* Bank Balance */}
        <section style={styles.balanceBox}>
          <div style={styles.balanceLabel}>Your Bank Balance</div>
          <div style={styles.balanceValue}>{bankBalance} ETH</div>
        </section>

        {/* Amount Input */}
        <div style={{ marginTop: 20 }}>
          <label style={styles.inputLabel}>Amount (ETH)</label>

          <input
            type="text"
            value={amount}
            placeholder="0.001"
            inputMode="decimal"
            onChange={(e) => {
              const v = e.target.value;
              if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v);
            }}
            style={styles.input}
          />
        </div>

        {/* Buttons */}
        <div style={styles.btnRow}>
          <button onClick={refreshBalances} style={styles.grayBtn}>
            {loading ? "Loading..." : "Refresh Balance"}
          </button>

          <button onClick={handleDeposit} disabled={!onHardhat} style={styles.depositBtn}>
            Deposit ETH
          </button>

          <button onClick={handleWithdraw} disabled={!onHardhat} style={styles.withdrawBtn}>
            Withdraw ETH
          </button>
        </div>

        {/* Transaction History */}
        <h2 style={{ marginTop: 32 }}>Transaction History</h2>

        {txHistory.length === 0 ? (
          <p>No transactions yet.</p >
        ) : (
          txHistory.map((tx, i) => (
            <div key={i} style={styles.txItem}>
              <strong style={{ color: tx.type === "Deposit" ? "#4f46e5" : "#dc2626" }}>
                {tx.type}
              </strong>{" "}
              {tx.amount} ETH
              <div style={{ fontSize: 12, opacity: 0.7 }}>{tx.timestamp}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =========================
// UI Styles
// =========================
const styles: any = {
  page: {
    minHeight: "100vh",
    padding: 40,
    background: "#f1f5f9",
    fontFamily: "Inter, system-ui",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    background: "white",
    padding: 32,
    borderRadius: 20,
    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    margin: 0,
  },
  switchBtn: {
    marginTop: 10,
    padding: "8px 16px",
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
  },
  statusBox: {
    marginTop: 24,
    background: "#f8fafc",
    padding: 16,
    borderRadius: 12,
  },
  balanceBox: {
    marginTop: 24,
    background: "#eef2ff",
    padding: 20,
    borderRadius: 16,
  },
  balanceLabel: { fontSize: 14, color: "#4b5563" },
  balanceValue: { fontSize: 32, fontWeight: 700 },

  inputLabel: { display: "block", marginBottom: 6, fontWeight: 500 },

  input: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: 16,
  },

  btnRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  grayBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: "#e5e7eb",
  },
  depositBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: "#4f46e5",
    color: "white",
  },
  withdrawBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: "#f97316",
    color: "white",
  },
  txItem: {
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
  },
};