"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

const ADRIA_POOL_ID = "pool1we9umarzn0l6jp8mcm98y28lxuuzcurzpjldnjwtgdhgw068mnr";

export const SUPPORTED_WALLETS = [
  { name: "eternl",      label: "Eternl",   icon: "/wallets/eternl.svg"  },
  { name: "nami",        label: "Nami",     icon: "/wallets/nami.svg"    },
  { name: "lace",        label: "Lace",     icon: "/wallets/lace.svg"    },
  { name: "vespr",       label: "Vespr",    icon: "/wallets/vespr.svg"   },
  { name: "flint",       label: "Flint",    icon: "/wallets/flint.svg"   },
  { name: "typhoncip30", label: "Typhon",   icon: "/wallets/typhon.svg"  },
  { name: "nufi",        label: "NuFi",     icon: "/wallets/nufi.svg"    },
  { name: "begin",       label: "Begin",    icon: "/wallets/begin.svg"   },
  { name: "gerowallet",  label: "Gero",     icon: "/wallets/gero.svg"    },
  { name: "yoroi",       label: "Yoroi",    icon: "/wallets/yoroi.svg"   },
];

export interface ConnectedWallet {
  name: string;
  label: string;
  address: string;
  rewardAddress: string;
  balanceLovelace: number;
  api: any; // CIP-30 API object
}

interface WalletCtx {
  wallet: ConnectedWallet | null;
  installedWallets: typeof SUPPORTED_WALLETS;
  connecting: boolean;
  error: string;
  connect: (walletName: string) => Promise<void>;
  disconnect: () => void;
  delegate: () => Promise<{ txHash?: string; error?: string }>;
}

const Ctx = createContext<WalletCtx>({
  wallet: null, installedWallets: [], connecting: false, error: "",
  connect: async () => {}, disconnect: () => {},
  delegate: async () => ({}),
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [installedWallets, setInstalledWallets] = useState<typeof SUPPORTED_WALLETS>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const detect = () => {
      if (typeof window !== "undefined" && (window as any).cardano) {
        setInstalledWallets(SUPPORTED_WALLETS.filter(w => !!(window as any).cardano[w.name]));
      }
    };
    detect();
    setTimeout(detect, 1000);
  }, []);

  // Auto-reconnect on page refresh
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("connectedWallet") : null;
    if (saved) {
      setTimeout(() => connect(saved), 800); // slight delay for wallet to inject
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async (walletName: string) => {
    setConnecting(true);
    setError("");
    try {
      // Use MeshJS BrowserWallet — handles all CBOR decoding + address resolution
      const { BrowserWallet } = await import("@meshsdk/core");
      const meshWallet = await BrowserWallet.enable(walletName);

      // Balance
      const lovelaceStr = await meshWallet.getLovelace();
      const balLovelace = parseInt(lovelaceStr || "0", 10) || 0;

      // Address
      const addrs = await meshWallet.getUsedAddresses();
      const address = addrs?.[0] || (await meshWallet.getUnusedAddresses())?.[0] || "";

      // Reward/stake address — MeshJS returns proper bech32
      let rewardAddress = "";
      try {
        const rewards = await meshWallet.getRewardAddresses();
        rewardAddress = rewards?.[0] || "";
      } catch {}

      // Raw CIP-30 API (needed for token balances and delegation tx)
      const cardano = (window as any).cardano;
      const api = cardano?.[walletName] ? await cardano[walletName].enable() : null;

      const wInfo = SUPPORTED_WALLETS.find(w => w.name === walletName)!;
      setWallet({
        name: walletName,
        label: wInfo.label,
        address: address ? `${address.slice(0, 12)}...${address.slice(-6)}` : "Connected",
        rewardAddress,
        balanceLovelace: balLovelace,
        api: api || meshWallet,
      });
      if (typeof window !== "undefined") localStorage.setItem("connectedWallet", walletName);
    } catch (e: any) {
      setError(e.message || "Connection failed");
    }
    setConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setError("");
    if (typeof window !== "undefined") localStorage.removeItem("connectedWallet");
  }, []);

  const delegate = useCallback(async () => {
    if (!wallet) return { error: "No wallet connected" };
    try {
      // Use MeshJS to build delegation tx
      const { BrowserWallet, Transaction } = await import("@meshsdk/core");
      const meshWallet = await BrowserWallet.enable(wallet.name);

      const rewardAddresses = await meshWallet.getRewardAddresses();
      const rewardAddr = rewardAddresses[0];
      if (!rewardAddr) return { error: "No reward address found" };

      const tx = new Transaction({ initiator: meshWallet });
      tx.delegateStake(rewardAddr, ADRIA_POOL_ID);

      const unsignedTx = await tx.build();
      const signedTx = await meshWallet.signTx(unsignedTx);
      const txHash = await meshWallet.submitTx(signedTx);
      return { txHash };
    } catch (e: any) {
      return { error: e.message || "Delegation failed" };
    }
  }, [wallet]);

  return (
    <Ctx.Provider value={{ wallet, installedWallets, connecting, error, connect, disconnect, delegate }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWallet = () => useContext(Ctx);
export { ADRIA_POOL_ID };
