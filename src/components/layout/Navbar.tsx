import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "@/contexts/Web3Context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatAddress } from "@/utils/contract";
import { Shield } from "lucide-react";

const Navbar = () => {
  const { address, balance, contract, connectWallet, disconnectWallet, isConnected, isConnecting } = useWeb3();
  const [isDefaultRelayer, setIsDefaultRelayer] = useState(false);

  // Check if user is default relayer
  useEffect(() => {
    const checkRelayerStatus = async () => {
      if (!contract || !address) return;
      
      try {
        const defaultRelayer = await contract.defaultRelayerWallet();
        setIsDefaultRelayer(defaultRelayer.toLowerCase() === address.toLowerCase());
      } catch (err) {
        console.error("Error checking relayer status:", err);
      }
    };
    
    checkRelayerStatus();
  }, [contract, address]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-5 w-5 text-white"
              >
                <path d="m3 17 2 2 4-4" />
                <path d="m3 7 2 2 4-4" />
                <path d="M13 6h8" />
                <path d="M13 12h8" />
                <path d="M13 18h8" />
              </svg>
            </div>
            <span className="font-bold text-xl">PolyVote</span>
          </Link>
        </div>
        
        <nav className="hidden md:flex flex-1 items-center gap-6 text-sm">
          <Link to="/" className="font-medium transition-colors hover:text-primary">
            Home
          </Link>
          <Link to="/create" className="font-medium transition-colors hover:text-primary">
            Create Poll
          </Link>
          <Link to="/browse" className="font-medium transition-colors hover:text-primary">
            Browse Polls
          </Link>
          <Link to="/dashboard" className="font-medium transition-colors hover:text-primary">
            Dashboard
          </Link>
          {isDefaultRelayer && (
            <Link to="/admin" className="relative font-medium transition-colors hover:text-primary">
              Admin Panel
              <Badge className="absolute -top-2 -right-6 bg-purple-600 flex items-center gap-1 text-[10px] px-1">
                <Shield className="h-2 w-2" />
                Admin
              </Badge>
            </Link>
          )}
        </nav>
        
        <div className="flex items-center justify-end space-x-4">
          {isConnected && address ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <div className="text-sm text-muted-foreground">
                  {balance} MATIC
                </div>
                <div className="font-medium address flex items-center gap-1">
                  {formatAddress(address)}
                  {isDefaultRelayer && (
                    <Badge className="bg-purple-600 flex items-center gap-1 text-[10px] px-1">
                      <Shield className="h-2 w-2" />
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={disconnectWallet}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button 
              onClick={connectWallet} 
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
