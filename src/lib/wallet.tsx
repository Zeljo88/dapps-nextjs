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
    // Re-detect after a short delay (some wallets inject late)
    setTimeout(detect, 1000);
  }, []);

  const connect = useCallback(async (walletName: string) => {
    setConnecting(true);
    setError("");
    try {
      const cardano = (window as any).cardano;
      if (!cardano?.[walletName]) throw new Error("Wallet not found. Please install it first.");
      const api = await cardano[walletName].enable();

      // Get balance — CBOR decode
      const balHex = await api.getBalance();
      let balLovelace = 0;
      try {
        const { decode } = await import("cbor-x");
        const decoded = decode(Buffer.from(balHex, "hex"));
        // Decoded is either a number (lovelace only) or [lovelace, multiasset]
        if (typeof decoded === "number" || typeof decoded === "bigint") {
          balLovelace = Number(decoded);
        } else if (Array.isArray(decoded)) {
          balLovelace = Number(decoded[0]);
        } else {
          balLovelace = 0;
        }
        if (!isFinite(balLovelace)) balLovelace = 0;
      } catch {
        balLovelace = 0;
      }

      // Get address
      let address = "";
      try {
        const addrs = await api.getUsedAddresses();
        address = addrs?.[0] || "";
        if (!address) {
          const unused = await api.getUnusedAddresses();
          address = unused?.[0] || "";
        }
      } catch {}

      // Get reward/stake address — CIP-30 returns hex-encoded address bytes
      let rewardAddress = "";
      try {
        const rewards = await api.getRewardAddresses();
        const raw = rewards?.[0] || "";
        if (raw.startsWith("stake")) {
          // Already bech32
          rewardAddress = raw;
        } else if (raw.length > 0) {
          // Try MeshJS resolver
          try {
            const { resolveRewardAddress } = await import("@meshsdk/core");
            // resolveRewardAddress takes a base address hex and returns stake1... bech32
            const usedAddrs = await api.getUsedAddresses();
            const firstAddr = usedAddrs?.[0] || "";
            if (firstAddr) {
              rewardAddress = resolveRewardAddress(firstAddr) || raw;
            } else {
              rewardAddress = raw;
            }
          } catch {
            rewardAddress = raw;
          }
        }
      } catch {}

      const wInfo = SUPPORTED_WALLETS.find(w => w.name === walletName)!;
      setWallet({
        name: walletName,
        label: wInfo.label,
        address: address ? `${address.slice(0, 10)}...${address.slice(-6)}` : "Connected",
        rewardAddress,
        balanceLovelace: balLovelace,
        api,
      });
    } catch (e: any) {
      setError(e.message || "Connection failed");
    }
    setConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setError("");
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
