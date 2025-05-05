// Update this page (the content is just a fallback if you fail to update the page)

import { useState, useEffect } from "react";
import { Server, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const [relayerStatus, setRelayerStatus] = useState<{ 
  available: boolean; 
  address: string; 
  authorized: boolean; 
  balance: string;
} | null>(null);
const [relayerLoading, setRelayerLoading] = useState(true);

useEffect(() => {
  const checkRelayerStatus = async () => {
    try {
      setRelayerLoading(true);
      const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3001';
      const response = await fetch(`${relayerUrl}/status`);
      
      if (response.ok) {
        const data = await response.json();
        setRelayerStatus({
          available: true,
          address: data.address,
          authorized: data.authorized,
          balance: data.balance
        });
      } else {
        setRelayerStatus({ 
          available: false,
          address: '',
          authorized: false,
          balance: '0'
        });
      }
    } catch (error) {
      console.error("Error checking relayer status:", error);
      setRelayerStatus({ 
        available: false,
        address: '',
        authorized: false,
        balance: '0'
      });
    } finally {
      setRelayerLoading(false);
    }
  };
  
  checkRelayerStatus();
}, []);

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your Blank App</h1>
        <p className="text-xl text-gray-600">Start building your amazing project here!</p>
      </div>
      <div className="bg-muted/30 p-4 rounded-lg mt-4">
        <h3 className="font-medium mb-2 flex items-center">
          <Server className="h-4 w-4 mr-2" />
          Gasless Voting Status
        </h3>
        
        {relayerLoading ? (
          <div className="text-sm text-muted-foreground flex items-center">
            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            Checking relayer service...
          </div>
        ) : relayerStatus?.available ? (
          <div className="text-sm">
            <div className="flex items-center text-green-600 mb-1">
              <CheckCircle2 className="h-3 w-3 mr-2" />
              <span>Relayer service is active</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Public polls are using gasless voting - you'll never pay gas fees!
            </p>
          </div>
        ) : (
          <div className="text-sm">
            <div className="flex items-center text-red-600 mb-1">
              <AlertCircle className="h-3 w-3 mr-2" />
              <span>Relayer service is not available</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Gasless voting may be unavailable. Please check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
