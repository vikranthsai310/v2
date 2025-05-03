import React, { useState, useEffect } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { ethers } from "ethers";
import { formatAddress } from "@/utils/contract";
import { Link } from "react-router-dom";
import RelayerTable from "@/components/RelayerTable";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Shield, AlertCircle, Info, CheckCircle2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

const AdminPanel = () => {
  const { address, contract, signer } = useWeb3();
  
  const [isDefaultRelayer, setIsDefaultRelayer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Relayer transfer state
  const [newRelayerAddress, setNewRelayerAddress] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  
  // Relayer authorization state
  const [newAuthRelayerAddress, setNewAuthRelayerAddress] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  
  // Check if current user is default relayer
  useEffect(() => {
    const checkRelayerStatus = async () => {
      if (!contract || !address) return;
      
      try {
        setLoading(true);
        const defaultRelayer = await contract.defaultRelayerWallet();
        setIsDefaultRelayer(defaultRelayer.toLowerCase() === address.toLowerCase());
      } catch (err: any) {
        console.error("Error checking relayer status:", err);
        setError(err.message || "Failed to check relayer status");
      } finally {
        setLoading(false);
      }
    };
    
    checkRelayerStatus();
  }, [contract, address]);
  
  // Handle transfer of default relayer role
  const handleTransferRelayerRole = async () => {
    if (!contract || !signer || !newRelayerAddress) return;
    
    try {
      setIsTransferring(true);
      setError("");
      
      if (!ethers.utils.isAddress(newRelayerAddress)) {
        throw new Error("Invalid Ethereum address");
      }
      
      // Send transaction
      const tx = await contract.updateDefaultRelayer(newRelayerAddress);
      
      toast.info("Transferring default relayer role. Waiting for confirmation...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update UI
      setTransferSuccess(true);
      toast.success(`Successfully transferred default relayer role to ${formatAddress(newRelayerAddress)}`);
      
      // Reset form
      setNewRelayerAddress("");
      setIsDefaultRelayer(false);
      
      setTimeout(() => setTransferSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error transferring relayer role:", err);
      
      // Check if user rejected transaction
      if (err.code === "ACTION_REJECTED" || 
          (err.message && (err.message.includes("user rejected") || 
                          err.message.includes("User denied")))) {
        setError("Transaction was rejected by user");
        toast.error("Transaction was rejected");
      } else {
        setError(err.message || "Failed to transfer relayer role");
        toast.error("Failed to transfer relayer role: " + err.message);
      }
    } finally {
      setIsTransferring(false);
    }
  };
  
  // Handle authorization of a new relayer
  const handleAuthorizeRelayer = async () => {
    if (!contract || !signer || !newAuthRelayerAddress) return;
    
    try {
      setIsAuthorizing(true);
      setError("");
      
      if (!ethers.utils.isAddress(newAuthRelayerAddress)) {
        throw new Error("Invalid Ethereum address");
      }
      
      // Check if already authorized
      const isAlreadyAuthorized = await contract.isAuthorizedRelayer(newAuthRelayerAddress);
      if (isAlreadyAuthorized) {
        throw new Error("This address is already an authorized relayer");
      }
      
      // Send transaction to authorize new relayer
      const tx = await contract.setRelayerStatus(newAuthRelayerAddress, true);
      
      toast.info("Authorizing new relayer. Waiting for confirmation...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update UI
      toast.success(`Successfully authorized new relayer: ${formatAddress(newAuthRelayerAddress)}`);
      
      // Reset form
      setNewAuthRelayerAddress("");
      
      // Force reload the relayer table
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      console.error("Error authorizing relayer:", err);
      
      // Check if user rejected transaction
      if (err.code === "ACTION_REJECTED" || 
          (err.message && (err.message.includes("user rejected") || 
                          err.message.includes("User denied")))) {
        setError("Transaction was rejected by user");
        toast.error("Transaction was rejected");
      } else {
        setError(err.message || "Failed to authorize relayer");
        toast.error("Failed to authorize relayer: " + err.message);
      }
    } finally {
      setIsAuthorizing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
        <p className="mb-8 text-muted-foreground">Loading...</p>
        
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }
  
  if (!isDefaultRelayer) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
        <p className="mb-6 text-muted-foreground">
          Administrative interface for contract management
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              This panel is only available to the default relayer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You do not have permission to access this page. Only the default relayer 
                wallet can use the admin panel.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
      <p className="mb-6 text-muted-foreground">
        Administrative interface for contract management
      </p>
      
      <div className="mb-8">
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <Shield className="h-4 w-4 text-green-500" />
          <AlertTitle>Default Relayer Status</AlertTitle>
          <AlertDescription>
            You are currently the default relayer for this contract. You have administrative 
            privileges to manage the relayer system.
          </AlertDescription>
        </Alert>
      </div>
      
      <Tabs defaultValue="relayers" className="mb-8">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="relayers" className="flex-1">
            Relayer Management
          </TabsTrigger>
          <TabsTrigger value="authorize" className="flex-1">
            Authorize Relayer
          </TabsTrigger>
          <TabsTrigger value="transfer" className="flex-1">
            Transfer Ownership
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="relayers">
          <RelayerTable />
        </TabsContent>
        
        <TabsContent value="authorize">
          <Card>
            <CardHeader>
              <CardTitle>Authorize New Relayer</CardTitle>
              <CardDescription>
                Add a new authorized relayer to the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newAuthRelayer">Relayer Wallet Address</Label>
                <Input
                  id="newAuthRelayer"
                  placeholder="0x..."
                  value={newAuthRelayerAddress}
                  onChange={(e) => setNewAuthRelayerAddress(e.target.value)}
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleAuthorizeRelayer}
                disabled={isAuthorizing || !newAuthRelayerAddress}
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Authorize Relayer
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Default Relayer Role</CardTitle>
              <CardDescription>
                Transfer your admin privileges to another address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning: Irreversible Action</AlertTitle>
                <AlertDescription>
                  Transferring the default relayer role will permanently revoke your 
                  administrative privileges. This action cannot be undone.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2 mt-4">
                <Label htmlFor="newRelayer">New Default Relayer Address</Label>
                <Input
                  id="newRelayer"
                  placeholder="0x..."
                  value={newRelayerAddress}
                  onChange={(e) => setNewRelayerAddress(e.target.value)}
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {transferSuccess && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Transfer Successful!</AlertTitle>
                  <AlertDescription>
                    Default relayer role has been transferred to the new address.
                    You no longer have administrative privileges.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="destructive"
                onClick={handleTransferRelayerRole}
                disabled={isTransferring || !newRelayerAddress}
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  "Transfer Default Relayer Role"
                )}
              </Button>
            </CardFooter>
          </Card>
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">About Role Transfer</h3>
                <p className="text-sm text-muted-foreground">
                  The default relayer is responsible for overseeing the relayer system and 
                  authorizing other relayers. Transferring this role should only be done 
                  to a trusted address that you control or to a known entity in the system.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminPanel; 