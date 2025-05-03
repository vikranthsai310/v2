import React, { useState, useEffect } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { formatAddress } from "@/utils/contract";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

// Interface for relayer data
interface RelayerInfo {
  address: string;
  isAuthorized: boolean;
  isDefault: boolean;
}

// List of test addresses to check if they are authorized relayers
// In a production environment, this would be replaced with an indexer or event-based system
const TEST_ADDRESSES = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Sample address 1
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Sample address 2
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Sample address 3
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // Sample address 4
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // Sample address 5
];

const RelayerTable = () => {
  const { contract, address, signer } = useWeb3();
  
  const [relayers, setRelayers] = useState<RelayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [defaultRelayer, setDefaultRelayer] = useState<string>("");
  const [fetchingAdditionalRelayers, setFetchingAdditionalRelayers] = useState(false);
  
  // Load relayers
  useEffect(() => {
    const loadRelayers = async () => {
      if (!contract) return;
      
      try {
        setLoading(true);
        
        // First, get the default relayer
        const defaultRelayerAddr = await contract.defaultRelayerWallet();
        setDefaultRelayer(defaultRelayerAddr);
        
        // Start with the default relayer
        const relayersData: RelayerInfo[] = [
          {
            address: defaultRelayerAddr,
            isAuthorized: true,
            isDefault: true
          }
        ];
        
        setRelayers(relayersData);
        
        // Load additional relayers
        setFetchingAdditionalRelayers(true);
        
        // In a real implementation with an indexer, you would query for all relayers
        // For now, we'll check a few test addresses to demonstrate the functionality
        const additionalRelayersPromises = TEST_ADDRESSES.map(async (addr) => {
          try {
            // Skip if it's the default relayer (already in the list)
            if (addr.toLowerCase() === defaultRelayerAddr.toLowerCase()) {
              return null;
            }
            
            // Check if this address is authorized
            const isAuthorized = await contract.isAuthorizedRelayer(addr);
            
            // We're returning all addresses that we've checked, including unauthorized ones
            // This allows us to display a complete list including revoked relayers
            return {
              address: addr,
              isAuthorized,
              isDefault: false
            };
          } catch (err) {
            console.error(`Error checking relayer status for ${addr}:`, err);
            return null;
          }
        });
        
        const additionalRelayers = await Promise.all(additionalRelayersPromises);
        
        // Filter out null values and add valid relayers to the list
        const validAdditionalRelayers = additionalRelayers.filter(
          (relayer): relayer is RelayerInfo => relayer !== null
        );
        
        setRelayers(prev => [...prev, ...validAdditionalRelayers]);
        
      } catch (error) {
        console.error("Error loading relayers:", error);
      } finally {
        setLoading(false);
        setFetchingAdditionalRelayers(false);
      }
    };
    
    loadRelayers();
  }, [contract]);
  
  // Handle revoking relayer access
  const handleRevokeRelayer = async (relayerAddress: string) => {
    if (!contract || !signer || relayerAddress === defaultRelayer) return;
    
    try {
      setIsRevoking(relayerAddress);
      
      // Call the contract to revoke authorization
      const tx = await contract.setRelayerStatus(relayerAddress, false);
      
      toast.info("Revoking relayer authorization...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update local state
      setRelayers(prev => 
        prev.map(relayer => 
          relayer.address === relayerAddress 
            ? { ...relayer, isAuthorized: false } 
            : relayer
        )
      );
      
      toast.success("Relayer authorization revoked successfully");
    } catch (error: any) {
      console.error("Error revoking relayer:", error);
      
      // Check if user rejected transaction
      if (error.code === "ACTION_REJECTED" || 
          (error.message && (error.message.includes("user rejected") || 
                          error.message.includes("User denied")))) {
        toast.error("Transaction was rejected");
      } else {
        toast.error("Failed to revoke relayer: " + error.message);
      }
    } finally {
      setIsRevoking(null);
    }
  };
  
  // Helper function to count authorized relayers
  const countAuthorizedRelayers = () => {
    return relayers.filter(r => r.isAuthorized).length;
  };
  
  // Helper function to count revoked relayers
  const countRevokedRelayers = () => {
    return relayers.filter(r => !r.isDefault && !r.isAuthorized).length;
  };
  
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Authorized Relayers</h2>
      
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-8 w-20 ml-auto" />
            </div>
          ))}
        </div>
      ) : relayers.length === 0 ? (
        <div className="text-center p-8 border rounded-lg">
          <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Relayers Found</h3>
          <p className="text-muted-foreground">
            There are no authorized relayers in the system yet.
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relayers.map(relayer => (
                <TableRow key={relayer.address}>
                  <TableCell className="font-mono">
                    {formatAddress(relayer.address)}
                  </TableCell>
                  <TableCell>
                    {relayer.isDefault ? (
                      <Badge className="bg-purple-600 flex items-center w-fit gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Default Relayer
                      </Badge>
                    ) : relayer.isAuthorized ? (
                      <Badge className="bg-green-600 flex items-center w-fit gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Authorized
                      </Badge>
                    ) : (
                      <Badge className="bg-red-600 flex items-center w-fit gap-1" variant="outline">
                        <XCircle className="h-3 w-3" />
                        Revoked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {relayer.isDefault ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled
                      >
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Protected
                      </Button>
                    ) : relayer.isAuthorized ? (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isRevoking === relayer.address || relayer.address === address}
                        onClick={() => handleRevokeRelayer(relayer.address)}
                      >
                        {isRevoking === relayer.address ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Revoking...
                          </>
                        ) : (
                          <>Revoke Access</>
                        )}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled
                      >
                        Revoked
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {fetchingAdditionalRelayers && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching for additional authorized relayers...</span>
            </div>
          )}
          
          {!loading && !fetchingAdditionalRelayers && (
            <div className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Authorized relayers:</span> {countAuthorizedRelayers()}
                {countAuthorizedRelayers() === 1 && " (default relayer only)"}
              </p>
              {countRevokedRelayers() > 0 && (
                <p>
                  <span className="font-medium">Revoked relayers:</span> {countRevokedRelayers()}
                </p>
              )}
            </div>
          )}
        </>
      )}
      
      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium mb-1">About Relayers</h3>
            <p className="text-sm text-muted-foreground">
              Relayers are responsible for submitting meta-transactions to the blockchain on behalf of users, 
              enabling gasless voting. The default relayer is created during contract deployment and cannot be revoked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelayerTable; 