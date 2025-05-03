
import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { ethers } from "ethers";
import { getProvider, getContract, CONTRACT_ADDRESS } from "@/utils/contract";

interface Web3ContextType {
  address: string | null;
  balance: string | null;
  chainId: number | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  contract: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

const Web3Context = createContext<Web3ContextType>({
  address: null,
  balance: null,
  chainId: null,
  provider: null,
  signer: null,
  contract: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  isConnecting: false,
  isConnected: false,
  error: null,
});

export const useWeb3 = () => useContext(Web3Context);

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider = ({ children }: Web3ProviderProps) => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const checkConnection = async () => {
      const cachedAddress = localStorage.getItem("connectedWalletAddress");
      if (cachedAddress) {
        try {
          await connectWallet();
        } catch (error) {
          console.error("Failed to reconnect wallet:", error);
          localStorage.removeItem("connectedWalletAddress");
        }
      }
    };

    checkConnection();
  }, []);

  // Handle account changes
  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected
          disconnectWallet();
        } else if (accounts[0] !== address) {
          // Address changed
          setAddress(accounts[0]);
          updateBalance(accounts[0]);
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        // Force page refresh on network change
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [address]);

  const updateBalance = async (currentAddress: string) => {
    if (!provider || !currentAddress) return;
    
    try {
      const balanceWei = await provider.getBalance(currentAddress);
      const balanceEth = ethers.utils.formatEther(balanceWei);
      setBalance(parseFloat(balanceEth).toFixed(4));
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      setError("MetaMask not detected. Please install MetaMask.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const web3Provider = getProvider();
      if (!web3Provider) throw new Error("Failed to get provider");

      // Request account access
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0];
      
      // Get chain ID
      const networkChainId = await web3Provider.getNetwork();
      
      // Get signer
      const web3Signer = web3Provider.getSigner();
      
      // Get contract instance
      const contractInstance = getContract(web3Signer);
      
      // Update state
      setProvider(web3Provider);
      setSigner(web3Signer);
      setContract(contractInstance);
      setAddress(account);
      setChainId(networkChainId.chainId);
      setIsConnected(true);
      
      // Save to localStorage
      localStorage.setItem("connectedWalletAddress", account);
      
      // Update balance
      updateBalance(account);
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      setError(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setBalance(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setIsConnected(false);
    localStorage.removeItem("connectedWalletAddress");
  };

  const value = {
    address,
    balance,
    chainId,
    provider,
    signer,
    contract,
    connectWallet,
    disconnectWallet,
    isConnecting,
    isConnected,
    error,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};
