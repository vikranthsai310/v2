import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWeb3 } from "@/contexts/Web3Context";
import { 
  Poll, 
  Candidate, 
  timeRemaining, 
  formatAddress, 
  formatTimestamp,
  signVote
} from "@/utils/contract";
import { submitMetaTransaction, getRelayerFunds } from "@/utils/metaTransaction";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";
import {
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  Share2,
  BarChart,
  ChevronLeft,
  InfoIcon,
  ExternalLink
} from "lucide-react";
import { ethers } from "ethers";
import { toast } from "sonner";

const PollDetails = () => {
  const { id } = useParams<{ id: string }>();
  const pollId = parseInt(id || "0");
  const navigate = useNavigate();
  const { contract, address, signer } = useWeb3();
  
  // Poll state
  const [poll, setPoll] = useState<Poll | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState("");
  
  // Voting state
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [txHash, setTxHash] = useState("");
  
  // Tab state
  const [activeTab, setActiveTab] = useState("vote");
  
  // Check if poll is active
  const isPollActive = poll ? Math.floor(Date.now() / 1000) < poll.endTime : false;
  
  // Check if poll is full
  const isPollFull = poll ? poll.voterCount >= poll.maxVoters : false;
  
  // Format remaining time
  const remaining = poll ? timeRemaining(poll.endTime) : "";
  
  // Define loadPollData outside of useEffect so it can be referenced elsewhere
  const loadPollData = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setError("");
      
      // Get poll details directly from blockchain
      const [
        title,
        creator,
        endTime,
        candidateCount,
        isPublic,
        voterCount,
        maxVoters
      ] = await contract.getPollDetails(pollId);
      
      const pollData: Poll = {
        id: pollId,
        title,
        creator,
        endTime: endTime.toNumber(),
        candidateCount: candidateCount,
        isPublic,
        voterCount: voterCount.toNumber(),
        maxVoters: maxVoters.toNumber()
      };
      
      // Get candidates directly from blockchain
      const candidatesData: Candidate[] = [];
      
      for (let i = 0; i < candidateCount; i++) {
        const [name, voteCount] = await contract.getCandidate(pollId, i);
        
        candidatesData.push({
          id: i,
          name,
          voteCount: voteCount.toNumber()
        });
      }
      
      // Check if user has voted directly from blockchain
      let userHasVoted = false;
      if (address) {
        userHasVoted = await contract.hasVoted(pollId, address);
        setHasVoted(userHasVoted);
      }
      
      // Set data from blockchain
      setPoll(pollData);
      setCandidates(candidatesData);
      
      // Set default tab based on poll status
      const isPollActive = pollData.endTime > Math.floor(Date.now() / 1000);
      if (!isPollActive || userHasVoted) {
        setActiveTab("results");
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading poll:", err);
      setError("Failed to load poll: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };
  
  // Load poll data and set up refresh interval
  useEffect(() => {
    loadPollData();
    
    // Set up interval to refresh data every 5 seconds for real-time updates
    const refreshInterval = setInterval(loadPollData, 5000);
    
    return () => clearInterval(refreshInterval);
  }, [contract, pollId, address]);
  
  // Get total votes
  const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0);
  
  // Calculate vote percentage
  const getVotePercentage = (voteCount: number) => {
    if (totalVotes === 0) return 0;
    return (voteCount / totalVotes) * 100;
  };
  
  // Check if creator has enough funds for voting
  const checkCreatorFunds = async () => {
    if (!contract || !poll) return true; // Assume funds are OK if we can't check
    
    try {
      // Get creator's funds
      const creator = poll.creator;
      const funds = await contract.relayerAllowance(creator, ethers.constants.AddressZero);
      const fundsEth = parseFloat(ethers.utils.formatEther(funds));
      
      // If funds are below threshold, show warning
      if (fundsEth < 0.005) { // 0.005 MATIC minimum threshold
        toast.warning("Creator funds are low", {
          description: "The poll creator has low funds, voting might fail. Consider notifying them.",
        });
        return false;
      }
      
      return true;
    } catch (err) {
      console.error("Error checking creator funds:", err);
      return true; // Proceed anyway if check fails
    }
  };
  
  // Handle direct vote
  const handleDirectVote = async () => {
    if (!contract || !address || !signer || selectedCandidate === null) return;
    
    try {
      setIsVoting(true);
      setVoteError("");
      
      // Check user has enough MATIC for gas
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const userBalance = await provider.getBalance(address);
      const userBalanceEth = parseFloat(ethers.utils.formatEther(userBalance));
      
      // Require at least 0.001 MATIC for gas
      if (userBalanceEth < 0.001) {
        throw new Error("Insufficient funds: Your wallet doesn't have enough MATIC to cover the gas fee. Please add at least 0.001 MATIC to your wallet.");
      }
      
      // Send transaction
      const tx = await contract.vote(pollId, selectedCandidate);
      setTxHash(tx.hash);
      
      toast.info("Voting transaction submitted! Waiting for confirmation...");
      
      // Wait for confirmation
      await tx.wait();
      
      // Update UI
      setHasVoted(true);
      setVoteSuccess(true);
      setActiveTab("results");
      
      // Update candidate vote count
      const updatedCandidates = [...candidates];
      updatedCandidates[selectedCandidate].voteCount += 1;
      setCandidates(updatedCandidates);
      
      // Update voter count
      if (poll) {
        setPoll({
          ...poll,
          voterCount: poll.voterCount + 1
        });
      }
      
      toast.success("Your vote has been recorded successfully!");
      
      // Force refresh browser page to update all components
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error("Error voting:", err);
      
      // Special handling for insufficient funds errors
      if (err.message && (
          err.message.includes("Insufficient funds") || 
          err.message.includes("insufficient funds") ||
          err.message.includes("gas required exceeds allowance")
         )) {
        setVoteError("You don't have enough MATIC in your wallet to cover the gas fee. Please add funds to your wallet.");
        toast.error("Insufficient funds for transaction", {
          description: "Please add MATIC to your wallet to cover gas fees.",
          duration: 5000,
        });
      } else {
        setVoteError(err.message || "Failed to vote");
        toast.error("Failed to vote: " + err.message);
      }
    } finally {
      setIsVoting(false);
    }
  };
  
  // Handle meta transaction (gasless) vote
  const handleMetaVote = async () => {
    if (!signer || !address || selectedCandidate === null) return;
    
    try {
      setIsVoting(true);
      setVoteError("");
      
      // Check creator funds before proceeding
      await checkCreatorFunds();
      
      toast.info("Signing vote message...");
      
      // Sign message using EIP-712 typed data
      const signature = await signVote(signer, pollId, selectedCandidate, address);
      
      toast.info("Submitting gasless vote...");
      
      // Submit meta-transaction to relayer
      const result = await submitMetaTransaction(
        pollId,
        selectedCandidate,
        address,
        signature
      );
      
      if (result.success) {
        // Update UI immediately but data will be refreshed from blockchain
        setHasVoted(true);
        setVoteSuccess(true);
        setActiveTab("results");
        setTxHash(result.txHash || "");
        
        // Show success message with blockchain transaction info
        if (result.txHash && result.txHash.startsWith("0x")) {
          toast.success("Your vote has been recorded on the blockchain!", {
            description: `Transaction: ${result.txHash.substring(0, 10)}...`,
            duration: 5000
          });
        } else {
          toast.success("Your vote has been recorded successfully!");
        }
        
        // Immediately refresh poll data from blockchain
        await loadPollData();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error("Error with meta-vote:", err);
      
      // Specific error handling for insufficient creator funds
      if (err.message && err.message.includes("creator doesn't have enough funds")) {
        setVoteError(
          "The poll creator hasn't deposited enough funds to cover gas fees for voting. " +
          "Please try again later or notify the creator to add more funds in their dashboard."
        );
        
        toast.error("Poll creator has insufficient funds", {
          description: "The creator needs to deposit more MATIC to enable voting.",
          duration: 5000,
        });
      } else {
        setVoteError(err.message || "Failed to submit gasless vote");
        toast.error("Failed to submit gasless vote: " + err.message);
      }
    } finally {
      setIsVoting(false);
    }
  };
  
  // Vote button handler - selects between direct and meta vote
  const handleVote = () => {
    if (poll?.isPublic) {
      // Use meta-transaction for public polls
      handleMetaVote();
    } else {
      // Use direct vote for private polls
      handleDirectVote();
    }
  };
  
  // Sort candidates by vote count
  const sortedCandidates = [...candidates].sort((a, b) => b.voteCount - a.voteCount);
  
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="flex items-center gap-2 mb-6">
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          <Skeleton className="h-6 w-24" />
        </div>
        
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }
  
  if (error || !poll) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-4">Error Loading Poll</h1>
        <p className="mb-6 text-muted-foreground">{error || "Poll not found"}</p>
        <Button onClick={() => navigate("/browse")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Polls
        </Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <Button 
        variant="ghost" 
        className="mb-6 -ml-2 text-muted-foreground" 
        onClick={() => navigate("/browse")}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Polls
      </Button>
      
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">{poll.title}</h1>
          <Badge variant={poll.isPublic ? "secondary" : "outline"}>
            {poll.isPublic ? "Public" : "Private"}
          </Badge>
          <Badge variant={isPollActive ? "default" : "destructive"}>
            {isPollActive ? "Active" : "Ended"}
          </Badge>
        </div>
        
        <p className="text-muted-foreground flex items-center gap-1">
          <User className="h-4 w-4" />
          <span>Created by </span>
          <span className="address">{formatAddress(poll.creator)}</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Time Remaining</div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">
                {isPollActive ? remaining : "Ended"}
              </div>
              <div className="text-sm text-muted-foreground">
                Ends {formatTimestamp(poll.endTime)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Participation</div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">
                {poll.voterCount}/{poll.maxVoters}
              </div>
              <div className="text-sm text-muted-foreground">
                {isPollFull ? "Maximum voters reached" : "Voters so far"}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Poll Type</div>
              {poll.isPublic ? (
                <Unlock className="h-4 w-4 text-green-500" />
              ) : (
                <Lock className="h-4 w-4 text-orange-500" />
              )}
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">
                {poll.isPublic ? "Public" : "Private"}
              </div>
              <div className="text-sm text-muted-foreground">
                {poll.isPublic 
                  ? "Anyone can vote (gasless)" 
                  : "Only whitelisted addresses"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Poll Details</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
              {txHash && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  asChild
                >
                  <a 
                    href={`https://polygonscan.com/tx/${txHash}`} 
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on Polygonscan"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value="vote" className="flex-1" disabled={!isPollActive || hasVoted || isPollFull}>
                Vote
              </TabsTrigger>
              <TabsTrigger value="results" className="flex-1">
                Results
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1">
                Information
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="vote" className="space-y-6">
              {!isPollActive ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Poll Ended</AlertTitle>
                  <AlertDescription>
                    This poll has ended. You can view the results.
                  </AlertDescription>
                </Alert>
              ) : hasVoted ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Already Voted</AlertTitle>
                  <AlertDescription>
                    You have already cast your vote in this poll.
                  </AlertDescription>
                </Alert>
              ) : isPollFull ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Maximum Voters Reached</AlertTitle>
                  <AlertDescription>
                    This poll has reached its maximum number of voters.
                  </AlertDescription>
                </Alert>
              ) : !address ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Wallet Not Connected</AlertTitle>
                  <AlertDescription>
                    Please connect your wallet to vote in this poll.
                  </AlertDescription>
                </Alert>
              ) : voteSuccess ? (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Vote Successful!</AlertTitle>
                  <AlertDescription>
                    Your vote has been recorded successfully.
                    {txHash && (
                      <div className="mt-2">
                        <a 
                          href={`https://polygonscan.com/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          View transaction
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <div>
                  <h3 className="text-lg font-medium mb-4">Select a candidate</h3>
                  
                  <div className="space-y-3">
                    {candidates.map((candidate) => (
                      <div 
                        key={candidate.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedCandidate === candidate.id 
                            ? "border-primary bg-primary/5" 
                            : "hover:border-muted-foreground"
                        }`}
                        onClick={() => setSelectedCandidate(candidate.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{candidate.name}</span>
                          
                          <div 
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              selectedCandidate === candidate.id 
                                ? "border-primary" 
                                : "border-muted"
                            }`}
                          >
                            {selectedCandidate === candidate.id && (
                              <div className="w-3 h-3 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {voteError && (
                    <Alert variant="destructive" className="mt-6">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{voteError}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="mt-6">
                    <Button 
                      className="w-full"
                      disabled={selectedCandidate === null || isVoting}
                      onClick={handleVote}
                    >
                      {isVoting ? "Processing..." : poll.isPublic ? "Vote (Gasless)" : "Vote"}
                    </Button>
                    
                    {poll.isPublic ? (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        You'll be asked to sign a message to confirm your vote.
                        No gas fees will be charged - the poll creator covers all gas costs.
                      </p>
                    ) : (
                      <Alert className="mt-2">
                        <InfoIcon className="h-4 w-4" />
                        <AlertDescription>
                          This vote requires MATIC in your wallet to cover gas fees. Make sure you have at least 0.001 MATIC.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="results">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Results</h3>
                  <div className="text-sm text-muted-foreground">
                    {totalVotes} total votes
                  </div>
                </div>
                
                <div className="space-y-6">
                  {sortedCandidates.map((candidate, index) => (
                    <div key={candidate.id}>
                      <div className="flex justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              index === 0 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span 
                            className={`font-medium ${index === 0 ? "text-primary" : ""}`}
                          >
                            {candidate.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {getVotePercentage(candidate.voteCount).toFixed(1)}%
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({candidate.voteCount} votes)
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={getVotePercentage(candidate.voteCount)} 
                        className={`h-2 ${index === 0 ? "bg-muted" : "bg-muted/50"}`}
                        indicatorClassName={index === 0 ? "bg-primary" : "bg-muted-foreground"}
                      />
                    </div>
                  ))}
                </div>
                
                {hasVoted && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>You've Voted</AlertTitle>
                    <AlertDescription>
                      You have cast your vote in this poll.
                    </AlertDescription>
                  </Alert>
                )}
                
                {!hasVoted && isPollActive && !isPollFull && (
                  <Button 
                    onClick={() => setActiveTab("vote")} 
                    className="w-full"
                    disabled={!address}
                  >
                    Cast Your Vote
                  </Button>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="info">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Poll Information</h3>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Poll ID</span>
                      <span className="font-mono">{poll.id}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Creator</span>
                      <span className="font-mono">{poll.creator}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Created At</span>
                      <span>N/A (not in contract)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">End Time</span>
                      <span>{formatTimestamp(poll.endTime)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Poll Type</span>
                      <span>{poll.isPublic ? "Public" : "Private (Whitelist)"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Candidate Count</span>
                      <span>{poll.candidateCount}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Current Voters</span>
                      <span>{poll.voterCount}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Maximum Voters</span>
                      <span>{poll.maxVoters}</span>
                    </div>
                  </div>
                </div>
                
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>About This Poll</AlertTitle>
                  <AlertDescription>
                    {poll.isPublic ? (
                      <span>
                        This is a public poll that allows gasless voting through meta-transactions.
                        Anyone can participate without paying gas fees - all gas costs are covered by the poll creator.
                      </span>
                    ) : (
                      <span>
                        This is a private poll where only whitelisted addresses can vote.
                        Voters need to pay gas fees for these transactions as they can't use the gasless voting system.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
                
                {txHash && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Your Activity</h3>
                    <a 
                      href={`https://polygonscan.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View your vote transaction
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PollDetails;
