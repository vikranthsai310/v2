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
import { submitMetaTransaction, getRelayerFunds, checkRelayerServiceStatus } from "@/utils/metaTransaction";
import { RELAYER_SERVICE_URL, CONTRACT_ADDRESS } from "@/utils/config";
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
  
  // Add new state for relayer status
  const [relayerStatus, setRelayerStatus] = useState<{ available: boolean; url: string } | null>(null);
  
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
  
  // Check relayer service status
  useEffect(() => {
    const checkRelayerStatus = async () => {
      try {
        const isAvailable = await checkRelayerServiceStatus();
        setRelayerStatus({ available: isAvailable, url: RELAYER_SERVICE_URL });
      } catch (error) {
        console.error("Error checking relayer status:", error);
        setRelayerStatus({ available: false, url: RELAYER_SERVICE_URL });
      }
    };
    
    checkRelayerStatus();
  }, []);
  
  // Handle direct vote
  const handleDirectVote = async () => {
    if (poll?.isPublic) {
      setVoteError("This is a public poll. Please use the gasless voting option. You will not be charged gas fees.");
      toast.error("Public polls only support gasless voting. No gas fees required.");
      return;
    }
    if (!contract || !address || !signer || selectedCandidate === null) return;
    
    try {
      setIsVoting(true);
      setVoteError("");
      
      // Add timeout to prevent endless processing state
      const processingTimeout = setTimeout(() => {
        if (isVoting) {
          setIsVoting(false);
          setVoteError(
            "Vote is taking longer than expected. The transaction might still be processing. " +
            "Please check back later or refresh the page to see if your vote was recorded."
          );
          toast.error("Vote processing timeout", {
            description: "Transaction is taking too long. It may still complete in the background.",
            duration: 7000,
          });
        }
      }, 60000); // 60 second timeout
      
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
      
      // Clear the timeout as we got a response
      clearTimeout(processingTimeout);
      
      // Show success message with blockchain transaction info
      toast.success("Your vote has been recorded successfully!");
      
      // Force refresh browser page to update all components
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error("Error voting:", err);
      
      // Special handling for insufficient funds errors
      if (err.message && (
          err.message.includes("Insufficient creator funds") || 
          err.message.includes("Insufficient funds")
         )) {
        setVoteError("The poll creator doesn't have enough funds to cover gas fees. Please try again later or notify the creator to add more funds.");
        toast.error("Insufficient creator funds", {
          description: "The poll creator needs to deposit more MATIC to cover gas fees.",
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
    // Set a processing timeout to prevent infinite loading states
    const processingTimeout = setTimeout(() => {
      setIsVoting(false);
      toast.error("Vote is taking longer than expected. Please check transaction status.");
    }, 60000); // 1 minute timeout

    try {
      // Verify user is not using the relayer wallet to vote (will fail)
      if (!address) {
        throw new Error("Please connect your wallet to vote");
      }
      
      // Check if the user is trying to vote with the relayer address
      const relayerAddress = '0xF0B5381A05A8d8368C7D3af031F7B50e979CeA12';
      if (address.toLowerCase() === relayerAddress.toLowerCase()) {
        throw new Error("You cannot vote with the relayer wallet address. Please use a different wallet.");
      }
      const contractAddress = CONTRACT_ADDRESS || '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';
      // Verify contract address is properly defined
      if (!contractAddress) {
        console.error("Error checking if voter is relayer: CONTRACT_ADDRESS is not defined");
        throw new Error("Application configuration error. Please contact support.");
      }

      // Ensure poll still active
      if (poll && poll.endTime < Math.floor(Date.now() / 1000)) {
        throw new Error("This poll has already ended");
      }
      
      // Validate selectedCandidate
      if (selectedCandidate === null || selectedCandidate === undefined) {
        throw new Error("Please select a candidate to vote for");
      }
      
      // Check if poll is full
      if (poll && poll.voterCount >= poll.maxVoters) {
        throw new Error("This poll has reached its maximum number of voters");
      }

      setIsVoting(true);
      
      // Check creator funds before proceeding
      await checkCreatorFunds();
      
      toast.info("Signing vote message...");
      
      // Ensure we have valid parameters
      console.log("Vote parameters:", {
        pollId,
        selectedCandidate,
        address
      });
      
      // Sign message using EIP-712 typed data
      const signature = await signVote(signer, pollId, selectedCandidate, address);
      
      // Verify we have a valid signature
      if (!signature || signature.length < 10) {
        throw new Error("Failed to sign the vote message. Please try again.");
      }
      
      console.log("Generated signature:", signature.substring(0, 20) + "...");
      
      toast.info("Submitting gasless vote...");
      
      // Store initial voted state for verification
      const initialVoted = hasVoted;
      
      // Submit meta-transaction to relayer (convert parameters to the correct types)
      const result = await submitMetaTransaction(
        Number(pollId), // Ensure this is a number
        Number(selectedCandidate), // Ensure this is a number
        address,
        signature,
        [] // No merkle proof for public polls
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
        
        // Verify after 10 seconds that vote was actually recorded
        setTimeout(async () => {
          try {
            if (!contract) return;
            console.log("Verifying vote was recorded after 10 seconds...");
            const votedAfterDelay = await contract.hasVoted(pollId, address);
            console.log("Vote recorded after 10 seconds:", votedAfterDelay);
            
            if (!votedAfterDelay) {
              console.warn("Vote may not have been recorded properly. Checking again...");
              
              // Check one more time after another delay
              setTimeout(async () => {
                try {
                  if (!contract) return;
                  console.log("Verifying vote was recorded after 25 seconds...");
                  const finalVoteCheck = await contract.hasVoted(pollId, address);
                  console.log("Vote recorded after 25 seconds:", finalVoteCheck);
                  
                  if (!finalVoteCheck) {
                    console.error("Vote still not recorded after verification checks");
                    
                    // Silent refresh of data
                    await loadPollData();
                    
                    // Only show error if user hasn't navigated away
                    if (window.location.href.includes(`/poll/${pollId}`)) {
                      toast.error("Your vote was not recorded correctly", {
                        description: "The transaction may have failed. Please try again or contact support.",
                        duration: 10000
                      });
                      
                      setVoteSuccess(false);
                      setHasVoted(false);
                      setVoteError("Vote transaction failed. This could be due to network issues or an issue with the smart contract. Please try again.");
                    }
                  } else {
                    console.log("Vote confirmed on second check");
                  }
                } catch (err) {
                  console.error("Error during second vote verification:", err);
                }
              }, 15000); // Check again after 15 more seconds
            } else {
              console.log("Vote successfully verified on blockchain");
            }
          } catch (err) {
            console.error("Error verifying vote:", err);
          }
        }, 10000); // Verify after 10 seconds
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
      } else if (err.message && err.message.includes("relayer wallet")) {
        setVoteError(
          "You cannot vote using the relayer wallet. Please connect with a different wallet."
        );
        
        toast.error("Cannot vote with relayer wallet", {
          description: "Switch to a different wallet to vote in this poll.",
          duration: 5000,
        });
      } else if (err.message && err.message.includes("poll has ended")) {
        setVoteError("This poll has ended. Voting is no longer possible.");
        
        toast.error("Poll has ended", {
          description: "The voting period for this poll has closed.",
          duration: 5000,
        });
      } else if (err.message && err.message.includes("maximum number of voters")) {
        setVoteError("This poll has reached its maximum number of voters.");
        
        toast.error("Poll is full", {
          description: "The maximum number of voters has been reached.",
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
  
  // Add troubleshooting UI when voting fails
  const renderTroubleshooting = () => {
    if (!voteError || !voteError.includes("relayer") || !relayerStatus) return null;
    
    return (
      <div className="mt-4 p-4 border border-yellow-200 bg-yellow-50 rounded-md">
        <h4 className="font-medium mb-2">Troubleshooting</h4>
        <div className="space-y-2 text-sm">
          <p>Relayer Service Status: 
            <span className={relayerStatus.available ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
              {relayerStatus.available ? " Online" : " Offline"}
            </span>
          </p>
          <p>Configured URL: {relayerStatus.url}</p>
          <div className="pt-2">
            <p className="font-medium">Solutions to try:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Check that the relayer service is running at the URL above</li>
              <li>Check your internet connection</li>
              <li>Try refreshing the page and voting again</li>
              <li>If using a local relayer, make sure it's running on port 3002</li>
            </ul>
          </div>
          <div className="pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                try {
                  // Direct API call to troubleshoot
                  const response = await fetch(`${RELAYER_SERVICE_URL}/status`);
                  const data = await response.json();
                  console.log("Direct relayer status check:", data);
                  
                  const isAvailable = await checkRelayerServiceStatus();
                  setRelayerStatus({ available: isAvailable, url: RELAYER_SERVICE_URL });
                  
                  if (data.success) {
                    toast.success("Relayer is online!", {
                      description: `Address: ${data.address} (${data.authorized ? "Authorized" : "Not Authorized"})`,
                    });
                  } else {
                    toast.error("Relayer returned an error");
                  }
                } catch (err) {
                  console.error("Direct API call error:", err);
                  toast.error("Failed to connect to relayer");
                  setRelayerStatus({ available: false, url: RELAYER_SERVICE_URL });
                }
              }}
            >
              Check Relayer Status
            </Button>
          </div>
        </div>
      </div>
    );
  };
  
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
                  {renderTroubleshooting()}
                  
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
                        <strong>This is a gasless vote - you don't pay any fees!</strong><br />
                        You'll be asked to sign a message to confirm your vote.
                        No gas fees will be charged - the poll creator covers all gas costs.
                      </p>
                    ) : (
                      <Alert className="mt-2">
                        <InfoIcon className="h-4 w-4" />
                        <AlertDescription>
                          This is a private poll. You'll need to submit a transaction, but the poll creator will reimburse your gas fees automatically.
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
