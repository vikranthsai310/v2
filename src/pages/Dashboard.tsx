import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "@/contexts/Web3Context";
import { ethers } from "ethers";
import { Poll, timeRemaining, formatAddress } from "@/utils/contract";
import { 
  initializeRelayerFunds, 
  getRelayerFunds, 
  updateRelayerFunds,
  DEFAULT_RELAYER_WALLET
} from "@/utils/metaTransaction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Clock,
  User,
  Users,
  Wallet,
  BarChart,
  Plus,
  ArrowRight,
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle2,
  Server,
  Shield,
  Loader2
} from "lucide-react";

const Dashboard = () => {
  const { address, balance, contract, signer } = useWeb3();
  const location = useLocation();
  
  // Get tab from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab');
  
  // Dashboard state
  const [userPolls, setUserPolls] = useState<Poll[]>([]);
  const [relayerFunds, setRelayerFunds] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>(tabParam || "polls");
  
  // Deposit state
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [depositError, setDepositError] = useState("");
  
  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState("0.0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  
  // Relayer state
  const [isDefaultRelayer, setIsDefaultRelayer] = useState(false);
  const [authorizedRelayers, setAuthorizedRelayers] = useState<string[]>([]);
  const [newRelayerAddress, setNewRelayerAddress] = useState("");
  const [isRelayerAuthorizing, setIsRelayerAuthorizing] = useState(false);
  const [relayerAuthSuccess, setRelayerAuthSuccess] = useState(false);
  const [relayerAuthError, setRelayerAuthError] = useState("");
  const [relayerAllowanceAmount, setRelayerAllowanceAmount] = useState("0.0");
  const [selectedRelayer, setSelectedRelayer] = useState("");
  const [isSettingAllowance, setIsSettingAllowance] = useState(false);
  const [isLoadingRelayers, setIsLoadingRelayers] = useState(false);
  
  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!contract || !address) return;
      
      try {
        setLoading(true);
        setError("");
        
        // Get poll count
        const count = await contract.getPollsCount();
        const pollCount = count.toNumber();
        
        // Load user's polls
        const userPollsData: Poll[] = [];
        
        for (let i = 0; i < pollCount; i++) {
          const [
            title,
            creator,
            endTime,
            candidateCount,
            isPublic,
            voterCount,
            maxVoters
          ] = await contract.getPollDetails(i);
          
          if (creator.toLowerCase() === address.toLowerCase()) {
            userPollsData.push({
              id: i,
              title,
              creator,
              endTime: endTime.toNumber(),
              candidateCount: candidateCount,
              isPublic,
              voterCount: voterCount.toNumber(),
              maxVoters: maxVoters.toNumber()
            });
          }
        }
        
        // Get relayer funds from our local tracking system
        // Initialize with contract value if it's the first time
        try {
          const funds = await contract.relayerAllowance(address, ethers.constants.AddressZero);
          const fundsEth = parseFloat(ethers.utils.formatEther(funds));
          
          // Initialize relayer funds in our local tracking system
          initializeRelayerFunds(address, fundsEth);
          
          // Then get the current value (which may have been updated by votes)
          const currentFunds = getRelayerFunds(address);
          setRelayerFunds(currentFunds.toString());
          
          console.log("Relayer funds initialized:", currentFunds);
          
          // Check if user is the default relayer
          const defaultRelayer = await contract.defaultRelayerWallet();
          setIsDefaultRelayer(defaultRelayer.toLowerCase() === address.toLowerCase());
          
          // If user is the default relayer, load authorized relayers
          if (defaultRelayer.toLowerCase() === address.toLowerCase()) {
            loadAuthorizedRelayers();
          }
          
        } catch (err) {
          console.error("Error getting relayer funds:", err);
          setRelayerFunds("0");
        }
        
        setUserPolls(userPollsData);
      } catch (err: any) {
        console.error("Error loading user data:", err);
        setError("Failed to load user data: " + (err.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    };
    
    // Function to load authorized relayers
    const loadAuthorizedRelayers = async () => {
      if (!contract) return;
      
      try {
        setIsLoadingRelayers(true);
        
        // For demonstration purposes, check some test addresses
        // In a production environment, use an indexer or event log to get all relayers
        const testAddresses = [
          "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
          "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
          "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
        ];
        
        const authorizedAddresses: string[] = [];
        
        // Get default relayer
        const defaultRelayer = await contract.defaultRelayerWallet();
        authorizedAddresses.push(defaultRelayer);
        
        // Check which addresses are authorized relayers
        for (const addr of testAddresses) {
          try {
            const isAuthorized = await contract.isAuthorizedRelayer(addr);
            if (isAuthorized) {
              authorizedAddresses.push(addr);
            }
          } catch (error) {
            console.error(`Error checking relayer status for ${addr}:`, error);
          }
        }
        
        setAuthorizedRelayers(authorizedAddresses);
      } catch (error) {
        console.error("Error loading authorized relayers:", error);
      } finally {
        setIsLoadingRelayers(false);
      }
    };
    
    loadUserData();
  }, [contract, address, depositSuccess, withdrawSuccess, relayerAuthSuccess]);
  
  // Handle deposit
  const handleDeposit = async () => {
    if (!contract || !signer || !address) return;
    
    try {
      setIsDepositing(true);
      setDepositError("");
      
      const amountWei = ethers.utils.parseEther(depositAmount);
      
      // Send transaction
      const tx = await contract.depositFunds({ value: amountWei });
      
      toast.info("Deposit transaction submitted! Waiting for confirmation...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update local relayer funds
      const depositAmountNum = parseFloat(depositAmount);
      const newFunds = updateRelayerFunds(address, depositAmountNum, true);
      setRelayerFunds(newFunds.toString());
      
      // Update UI
      setDepositSuccess(true);
      toast.success(`Successfully deposited ${depositAmount} MATIC`);
      
      setTimeout(() => setDepositSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error depositing funds:", err);
      setDepositError(err.message || "Failed to deposit funds");
      toast.error("Failed to deposit: " + err.message);
    } finally {
      setIsDepositing(false);
    }
  };
  
  // Handle withdraw
  const handleWithdraw = async () => {
    if (!contract || !signer || !address) return;
    
    try {
      setIsWithdrawing(true);
      setWithdrawError("");
      
      const amountWei = ethers.utils.parseEther(withdrawAmount);
      
      // Send transaction
      const tx = await contract.withdrawFunds(amountWei);
      
      toast.info("Withdrawal transaction submitted! Waiting for confirmation...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update local relayer funds
      const withdrawAmountNum = parseFloat(withdrawAmount);
      const newFunds = updateRelayerFunds(address, withdrawAmountNum, false);
      setRelayerFunds(newFunds.toString());
      
      // Update UI
      setWithdrawSuccess(true);
      toast.success(`Successfully withdrew ${withdrawAmount} MATIC`);
      
      setTimeout(() => setWithdrawSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error withdrawing funds:", err);
      setWithdrawError(err.message || "Failed to withdraw funds");
      toast.error("Failed to withdraw: " + err.message);
    } finally {
      setIsWithdrawing(false);
    }
  };
  
  // Handle relayer authorization
  const handleRelayerAuth = async () => {
    if (!contract || !signer || !address || !newRelayerAddress) return;
    
    try {
      setIsRelayerAuthorizing(true);
      setRelayerAuthError("");
      
      if (!ethers.utils.isAddress(newRelayerAddress)) {
        throw new Error("Invalid Ethereum address");
      }
      
      // Send transaction
      const tx = await contract.setRelayerStatus(newRelayerAddress, true);
      
      toast.info("Relayer authorization submitted! Waiting for confirmation...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update UI
      setRelayerAuthSuccess(true);
      toast.success(`Successfully authorized relayer ${formatAddress(newRelayerAddress)}`);
      
      // Reset form
      setNewRelayerAddress("");
      
      setTimeout(() => setRelayerAuthSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error authorizing relayer:", err);
      setRelayerAuthError(err.message || "Failed to authorize relayer");
      toast.error("Failed to authorize relayer: " + err.message);
    } finally {
      setIsRelayerAuthorizing(false);
    }
  };
  
  // Handle setting relayer allowance
  const handleSetRelayerAllowance = async () => {
    if (!contract || !signer || !selectedRelayer) return;
    
    try {
      setIsSettingAllowance(true);
      
      // Parse amount
      const amount = ethers.utils.parseEther(relayerAllowanceAmount);
      
      // Set allowance
      const tx = await contract.setRelayerAllowance(selectedRelayer, amount);
      
      toast.info("Setting relayer allowance...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update state
      // Note: This is a simplified implementation, in a real app we'd track specific relayer allowances
      const generalFunds = parseFloat(relayerFunds);
      const allowanceAmount = parseFloat(relayerAllowanceAmount);
      const newGeneralFunds = Math.max(0, generalFunds - allowanceAmount);
      
      // Update displayed general funds
      setRelayerFunds(newGeneralFunds.toString());
      
      // Clear form
      setRelayerAllowanceAmount("0.0");
      setSelectedRelayer("");
      
      toast.success(`Successfully set allowance of ${relayerAllowanceAmount} MATIC for relayer`);
    } catch (error: any) {
      console.error("Error setting relayer allowance:", error);
      
      if (error.code === "ACTION_REJECTED" || 
          (error.message && (error.message.includes("user rejected") || 
                            error.message.includes("User denied")))) {
        toast.error("Transaction was rejected");
      } else {
        toast.error("Failed to set relayer allowance: " + error.message);
      }
    } finally {
      setIsSettingAllowance(false);
    }
  };
  
  // Effect for showing notification when redirected from admin panel
  useEffect(() => {
    if (tabParam === 'relayers') {
      toast.info("You're now in the Relayer Management tab where you can authorize new relayers.", {
        duration: 5000,
      });
    }
  }, [tabParam]);
  
  // Sort polls by creation (most recent first)
  const sortedPolls = [...userPolls].reverse();
  
  if (!address) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h1 className="text-3xl font-bold mb-4">User Dashboard</h1>
        <p className="mb-6 text-muted-foreground">
          Please connect your wallet to view your dashboard.
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">User Dashboard</h1>
      <p className="mb-6 text-muted-foreground">
        Manage your polls and funds
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Wallet</CardTitle>
            <CardDescription>
              Your connected wallet details
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Address</span>
              <span className="font-mono">{formatAddress(address)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Balance</span>
              <span>{balance} MATIC</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Relayer Funds</span>
              <span>{parseFloat(relayerFunds).toFixed(4)} MATIC</span>
            </div>
            {isDefaultRelayer && (
              <div className="flex justify-between py-2 border-t">
                <span className="text-muted-foreground">Status</span>
                <span className="text-green-600 flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  Default Relayer
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Stats</CardTitle>
            <CardDescription>
              Your voting statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b items-center">
              <span className="text-muted-foreground">Polls Created</span>
              <span className="text-2xl font-bold">{userPolls.length}</span>
            </div>
            <div className="flex justify-between py-2 border-b items-center">
              <span className="text-muted-foreground">Active Polls</span>
              <span className="text-2xl font-bold">
                {userPolls.filter(p => Math.floor(Date.now() / 1000) < p.endTime).length}
              </span>
            </div>
            <div className="flex justify-between py-2 items-center">
              <span className="text-muted-foreground">Total Votes Received</span>
              <span className="text-2xl font-bold">
                {userPolls.reduce((sum, poll) => sum + poll.voterCount, 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue={activeTab} className="mb-8" onValueChange={setActiveTab}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="polls" className="flex-1">
            My Polls
          </TabsTrigger>
          <TabsTrigger value="funding" className="flex-1">
            Fund Management
          </TabsTrigger>
          {isDefaultRelayer && (
            <TabsTrigger value="relayers" className="flex-1">
              Relayer Management
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="polls">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Your Polls</CardTitle>
                <Button asChild size="sm">
                  <Link to="/create">
                    <Plus className="h-4 w-4 mr-1" />
                    Create New Poll
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : sortedPolls.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Polls Created</h3>
                  <p className="text-muted-foreground mb-6">
                    You haven't created any polls yet.
                  </p>
                  <Button asChild>
                    <Link to="/create">Create Your First Poll</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedPolls.map(poll => (
                    <div 
                      key={poll.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 border rounded-lg p-4"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{poll.title}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{timeRemaining(poll.endTime)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{poll.voterCount}/{poll.maxVoters}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                      >
                        <Link to={`/polls/${poll.id}`}>
                          View
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="funding">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Deposit Funds</CardTitle>
                <CardDescription>
                  Add MATIC to cover gas fees for voters participating in your polls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Amount (MATIC)</span>
                    <span className="text-sm text-muted-foreground">
                      Balance: {balance} MATIC
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                
                {depositSuccess && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertTitle>Deposit Successful!</AlertTitle>
                    <AlertDescription>
                      Your funds have been added to your relayer allowance.
                    </AlertDescription>
                  </Alert>
                )}
                
                {depositError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{depositError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleDeposit}
                  disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="w-full"
                >
                  {isDepositing ? "Processing..." : "Deposit Funds"}
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Withdraw Funds</CardTitle>
                <CardDescription>
                  Withdraw unused MATIC from your relayer allowance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Amount (MATIC)</span>
                    <span className="text-sm text-muted-foreground">
                      Available: {parseFloat(relayerFunds).toFixed(4)} MATIC
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={relayerFunds}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
                
                {withdrawSuccess && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertTitle>Withdrawal Successful!</AlertTitle>
                    <AlertDescription>
                      Your funds have been sent to your wallet.
                    </AlertDescription>
                  </Alert>
                )}
                
                {withdrawError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{withdrawError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleWithdraw}
                  disabled={
                    isWithdrawing || 
                    !withdrawAmount || 
                    parseFloat(withdrawAmount) <= 0 ||
                    parseFloat(withdrawAmount) > parseFloat(relayerFunds)
                  }
                  className="w-full"
                >
                  {isWithdrawing ? "Processing..." : "Withdraw Funds"}
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">About Fund Management</h3>
                <p className="text-sm text-muted-foreground">
                  When you create polls, you need to deposit MATIC to cover gas fees for voters using the gasless voting feature. 
                  Voters never need to pay for gas - all fees are covered by poll creators. This makes the voting experience 
                  completely free for participants while you maintain control over your polls.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {isDefaultRelayer && (
          <TabsContent value="relayers">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Authorize New Relayer</CardTitle>
                  <CardDescription>
                    Add a new address to the list of authorized relayers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tabParam === 'relayers' && (
                    <Alert className="mb-4 bg-blue-50 text-blue-800 border-blue-200">
                      <Info className="h-4 w-4 text-blue-500" />
                      <AlertTitle>Navigation from Admin Panel</AlertTitle>
                      <AlertDescription>
                        You can authorize new relayers here and then manage them from the Admin Panel.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Relayer Address</span>
                    </div>
                    <Input
                      placeholder="0x..."
                      value={newRelayerAddress}
                      onChange={(e) => setNewRelayerAddress(e.target.value)}
                    />
                  </div>
                  
                  {relayerAuthSuccess && (
                    <Alert className="bg-green-50 text-green-800 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertTitle>Authorization Successful!</AlertTitle>
                      <AlertDescription>
                        The relayer has been authorized to process meta-transactions.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {relayerAuthError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{relayerAuthError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleRelayerAuth}
                    disabled={isRelayerAuthorizing || !newRelayerAddress}
                    className="w-full"
                  >
                    {isRelayerAuthorizing ? "Processing..." : "Authorize Relayer"}
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Set Relayer Allowance</CardTitle>
                  <CardDescription>
                    Allocate funds to a specific relayer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Relayer Address</span>
                    {isLoadingRelayers ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading relayers...</span>
                      </div>
                    ) : authorizedRelayers.length > 0 ? (
                      <select 
                        className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        value={selectedRelayer}
                        onChange={(e) => setSelectedRelayer(e.target.value)}
                      >
                        <option value="">Select a relayer</option>
                        {authorizedRelayers.map(relayer => (
                          <option key={relayer} value={relayer}>
                            {formatAddress(relayer)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        placeholder="0x..."
                        value={selectedRelayer}
                        onChange={(e) => setSelectedRelayer(e.target.value)}
                      />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Amount (MATIC)</span>
                      <span className="text-sm text-muted-foreground">
                        Available: {parseFloat(relayerFunds).toFixed(4)} MATIC
                      </span>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={relayerFunds}
                      value={relayerAllowanceAmount}
                      onChange={(e) => setRelayerAllowanceAmount(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleSetRelayerAllowance}
                    disabled={
                      isSettingAllowance || 
                      !relayerAllowanceAmount || 
                      !selectedRelayer ||
                      parseFloat(relayerAllowanceAmount) <= 0 ||
                      parseFloat(relayerAllowanceAmount) > parseFloat(relayerFunds)
                    }
                    className="w-full"
                  >
                    {isSettingAllowance ? "Processing..." : "Set Allowance"}
                  </Button>
                </CardFooter>
              </Card>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Server className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">About Relayer Management</h3>
                    <p className="text-sm text-muted-foreground">
                      As the default relayer, you can authorize other addresses to process meta-transactions 
                      on behalf of poll creators. This allows for a distributed network of relayers to handle 
                      gasless voting transactions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Dashboard;
