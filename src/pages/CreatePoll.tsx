import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "@/contexts/Web3Context";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Info, 
  Plus, 
  Trash, 
  Upload,
  AlertCircle
} from "lucide-react";
import { parseAddressCSV, generateMerkleTree } from "@/utils/metaTransaction";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// Constants
const MIN_MATIC_DEPOSIT = 0.01;
const MAX_MATIC_DEPOSIT = 1;
const MATIC_TO_INR = 73; // Mock conversion rate

const CreatePoll = () => {
  const navigate = useNavigate();
  const { contract, address, isConnected } = useWeb3();
  
  // Form state
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState<string[]>(["", ""]);
  const [duration, setDuration] = useState("24");
  const [isPublic, setIsPublic] = useState(true);
  const [maxVoters, setMaxVoters] = useState(100);
  const [deposit, setDeposit] = useState(MIN_MATIC_DEPOSIT);
  
  // Whitelist state
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  
  // Add a candidate field
  const addCandidate = () => {
    setCandidates([...candidates, ""]);
  };
  
  // Remove a candidate field
  const removeCandidate = (index: number) => {
    if (candidates.length <= 2) return;
    const newCandidates = [...candidates];
    newCandidates.splice(index, 1);
    setCandidates(newCandidates);
  };
  
  // Update a candidate
  const updateCandidate = (index: number, value: string) => {
    const newCandidates = [...candidates];
    newCandidates[index] = value;
    setCandidates(newCandidates);
  };
  
  // Handle CSV upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => {
      const csvContent = reader.result as string;
      const addresses = parseAddressCSV(csvContent);
      setWhitelist(addresses);
    };
    reader.onerror = () => {
      setError("Error reading CSV file");
    };
  };
  
  // Add addresses from textarea
  const addAddressesFromInput = () => {
    const addresses = parseAddressCSV(whitelistInput);
    const newWhitelist = [...new Set([...whitelist, ...addresses])];
    setWhitelist(newWhitelist);
    setWhitelistInput("");
  };
  
  // Calculate cost
  const calculateCost = () => {
    // Base cost for poll creation
    const baseCost = 0.01;
    
    // Additional cost based on max voters and duration
    const voterFactor = maxVoters / 100;
    const durationFactor = parseInt(duration) / 24;
    
    // Total estimated cost
    const totalCost = baseCost + (voterFactor * 0.005) + (durationFactor * 0.002);
    
    return Math.min(Math.max(totalCost, MIN_MATIC_DEPOSIT), MAX_MATIC_DEPOSIT);
  };
  
  // Update deposit when relevant factors change
  React.useEffect(() => {
    const calculatedCost = calculateCost();
    setDeposit(calculatedCost);
  }, [maxVoters, duration]);
  
  // Validate form
  const validateForm = () => {
    if (!title.trim()) {
      setError("Title is required");
      return false;
    }
    
    if (candidates.some(c => !c.trim())) {
      setError("All candidate fields must be filled");
      return false;
    }
    
    if (candidates.length < 2) {
      setError("At least 2 candidates are required");
      return false;
    }
    
    if (!isPublic && whitelist.length === 0) {
      setError("Whitelist is required for private polls");
      return false;
    }
    
    return true;
  };
  
  // Create poll
  const createPoll = async () => {
    if (!contract || !address) {
      setError("Wallet not connected");
      return;
    }
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError("");
    
    try {
      // Prepare arguments
      let merkleRoot = ethers.constants.HashZero;
      let merkleDepth = 0;
      
      if (!isPublic && whitelist.length > 0) {
        const merkleTree = generateMerkleTree(whitelist);
        merkleRoot = merkleTree.getRoot();
        merkleDepth = merkleTree.getDepth();
      }
      
      // Convert deposit to wei
      const depositWei = ethers.utils.parseEther(deposit.toString());
      
      // Create poll with gas estimation
      const gasEstimate = await contract.estimateGas.createPoll(
        title,
        candidates,
        parseInt(duration),
        isPublic,
        maxVoters,
        merkleRoot,
        merkleDepth,
        { value: depositWei }
      );
      
      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100);
      
      // Create poll with gas limit
      const tx = await contract.createPoll(
        title,
        candidates,
        parseInt(duration),
        isPublic,
        maxVoters,
        merkleRoot,
        merkleDepth,
        { 
          value: depositWei,
          gasLimit: gasLimit
        }
      );
      
      toast.info("Transaction submitted! Waiting for confirmation...");
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success("Poll created successfully!");
        // Navigate to browse
        navigate("/browse");
      } else {
        throw new Error("Transaction failed");
      }
    } catch (err: any) {
      console.error("Error creating poll:", err);
      
      // Check if user rejected transaction
      if (err.code === "ACTION_REJECTED" || 
          (err.message && (err.message.includes("user rejected") || 
                          err.message.includes("User denied")))) {
        toast.error("Transaction was rejected");
        setError("You rejected the transaction. To create a poll, please confirm the transaction in your wallet.");
      } else if (err.message && err.message.includes("insufficient funds")) {
        toast.error("Insufficient funds");
        setError("You don't have enough MATIC to create the poll. Please add more funds to your wallet.");
      } else {
        // Other error
        setError(err.message || "Error creating poll");
        toast.error("Failed to create poll: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Next step
  const nextStep = () => {
    if (step === 1 && !validateFormStep1()) return;
    setStep(prev => prev + 1);
  };
  
  // Previous step
  const prevStep = () => {
    setStep(prev => prev - 1);
  };
  
  // Validate first step
  const validateFormStep1 = () => {
    if (!title.trim()) {
      setError("Title is required");
      return false;
    }
    
    if (candidates.some(c => !c.trim())) {
      setError("All candidate fields must be filled");
      return false;
    }
    
    if (candidates.length < 2) {
      setError("At least 2 candidates are required");
      return false;
    }
    
    setError("");
    return true;
  };
  
  if (!isConnected) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h1 className="text-3xl font-bold mb-4">Create Poll</h1>
        <p className="mb-6 text-muted-foreground">
          Please connect your wallet to create a poll.
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Create Poll</h1>
      <p className="mb-6 text-muted-foreground">
        Create a new poll on Polygon blockchain with gasless voting for participants.
      </p>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Step indicator */}
      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 z-0"></div>
        
        {[1, 2, 3].map((s) => (
          <div key={s} className="z-10 flex flex-col items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                s === step 
                  ? "bg-primary text-primary-foreground" 
                  : s < step 
                    ? "bg-primary/20 text-primary" 
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            <span className={`text-xs mt-1 ${
              s === step 
                ? "text-foreground font-medium" 
                : "text-muted-foreground"
            }`}>
              {s === 1 ? "Poll Details" : s === 2 ? "Configuration" : "Review & Create"}
            </span>
          </div>
        ))}
      </div>
      
      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Poll Details</CardTitle>
            <CardDescription>
              Enter the basic information about your poll
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Poll Title</Label>
              <Input 
                id="title" 
                placeholder="Enter poll title" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Candidates</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addCandidate}
                  disabled={candidates.length >= 10}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Candidate
                </Button>
              </div>
              
              {candidates.map((candidate, index) => (
                <div key={index} className="flex gap-2">
                  <Input 
                    placeholder={`Candidate ${index + 1}`}
                    value={candidate}
                    onChange={(e) => updateCandidate(index, e.target.value)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeCandidate(index)}
                    disabled={candidates.length <= 2}
                  >
                    <Trash className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" disabled>
              Back
            </Button>
            <Button onClick={nextStep}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {/* Step 2: Configuration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Poll Configuration</CardTitle>
            <CardDescription>
              Configure your poll settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours)</Label>
              <Select 
                value={duration} 
                onValueChange={setDuration}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">2 days</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between space-x-4">
              <Label htmlFor="public">Public Poll</Label>
              <Switch 
                id="public" 
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="max-voters">Maximum Voters: {maxVoters}</Label>
              </div>
              <Slider 
                id="max-voters"
                min={10}
                max={1000}
                step={10}
                value={[maxVoters]}
                onValueChange={(value) => setMaxVoters(value[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10</span>
                <span>1000</span>
              </div>
            </div>
            
            {!isPublic && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium">Whitelist Configuration</h3>
                
                <div>
                  <Label htmlFor="csv-upload">Upload addresses CSV</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input 
                      id="csv-upload" 
                      type="file" 
                      accept=".csv,.txt" 
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById("csv-upload")?.click()}
                      className="w-full justify-start"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {csvFile ? csvFile.name : "Choose file"}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="whitelist-input">Or enter addresses manually</Label>
                  <Textarea 
                    id="whitelist-input"
                    placeholder="Enter Ethereum addresses, separated by commas or new lines"
                    rows={3}
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addAddressesFromInput}
                    disabled={!whitelistInput.trim()}
                  >
                    Add Addresses
                  </Button>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Whitelist ({whitelist.length} addresses)</Label>
                    {whitelist.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setWhitelist([])}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  {whitelist.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto border rounded p-2 text-sm">
                      {whitelist.map((addr, i) => (
                        <div key={i} className="font-mono text-xs mb-1 truncate">
                          {addr}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border rounded p-4 text-center text-muted-foreground text-sm">
                      No addresses added
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={prevStep}>
              Back
            </Button>
            <Button onClick={nextStep}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {/* Step 3: Review & Create */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
            <CardDescription>
              Review your poll details and create
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Poll Title
                </h3>
                <p className="text-lg">{title}</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Candidates
                </h3>
                <ul className="space-y-1">
                  {candidates.map((candidate, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <span>{candidate}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Duration
                  </h3>
                  <p>{duration} hours</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Poll Type
                  </h3>
                  <p>{isPublic ? "Public" : "Whitelist only"}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Maximum Voters
                  </h3>
                  <p>{maxVoters}</p>
                </div>
                
                {!isPublic && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Whitelist Size
                    </h3>
                    <p>{whitelist.length} addresses</p>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="font-medium flex items-center gap-1 mb-2">
                    <Info className="h-4 w-4" />
                    Cost Estimate
                  </h3>
                  
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Deposit amount:</span>
                    <span className="font-medium">{deposit.toFixed(4)} MATIC</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">≈ INR value:</span>
                    <span>₹{(deposit * MATIC_TO_INR).toFixed(2)}</span>
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="deposit">Adjust Deposit</Label>
                    <Slider 
                      id="deposit"
                      min={MIN_MATIC_DEPOSIT}
                      max={MAX_MATIC_DEPOSIT}
                      step={0.01}
                      value={[deposit]}
                      onValueChange={(value) => setDeposit(value[0])}
                      className="my-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{MIN_MATIC_DEPOSIT} MATIC</span>
                      <span>{MAX_MATIC_DEPOSIT} MATIC</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mt-2">
                  This deposit will be used to cover gas fees for voters participating in your poll. As the creator, you pay for all voting gas fees so voters can participate for free.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={prevStep}>
              Back
            </Button>
            <Button 
              onClick={createPoll}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Poll"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default CreatePoll;
