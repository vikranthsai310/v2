import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/utils/contract";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Vote, ClipboardCheck, Server, Shield } from "lucide-react";

const CONTRACT_ADDRESS = "0xf928b4919fe4eef1effde65239697024dd90a532";

const Home = () => {
  const copyAddressToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(CONTRACT_ADDRESS);
      alert("Contract address copied to clipboard!");
    } else {
      // Fallback for browsers where clipboard API is not available
      const textArea = document.createElement("textarea");
      textArea.value = CONTRACT_ADDRESS;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert("Contract address copied to clipboard!");
      } catch (err) {
        alert("Failed to copy address: " + CONTRACT_ADDRESS);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Gas-Optimized Voting System on Polygon</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Create and participate in polls with ultra-efficient gas optimization
          </p>
          
          <div className="flex gap-4 justify-center mb-8">
            <Button asChild size="lg">
              <Link to="/create">Create Poll</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/browse">Browse Polls</Link>
            </Button>
          </div>
          
          <div className="inline-flex items-center p-2 rounded-md bg-muted mb-4">
            <span className="mr-2 text-sm">Deployed Contract:</span>
            <Badge 
              variant="outline" 
              className="font-mono cursor-pointer"
              onClick={copyAddressToClipboard}
            >
              {formatAddress(CONTRACT_ADDRESS)} (click to copy)
            </Badge>
            <Badge className="ml-2 bg-green-600">Polygon Mainnet</Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5" />
                Gas Efficiency
              </CardTitle>
              <CardDescription>Optimized voting with minimal gas costs</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Our voting system uses bitmap storage and advanced optimization techniques to minimize gas costs for both poll creation and voting.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Gasless Voting
              </CardTitle>
              <CardDescription>Vote without paying gas fees</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Participants can vote without paying gas fees thanks to our meta-transaction relayer infrastructure, making the system accessible to all users.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Secure & Trustless
              </CardTitle>
              <CardDescription>Cryptographically secure voting</CardDescription>
            </CardHeader>
            <CardContent>
              <p>All votes are cryptographically verified and stored on the Polygon blockchain, ensuring transparency and immutability.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Whitelist Support
              </CardTitle>
              <CardDescription>Create private polls for selected participants</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Our system supports both public polls and whitelisted polls using Merkle tree verification for gas-efficient access control.</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
          <Button asChild>
            <Link to="/create" className="flex items-center gap-2">
              Create Your First Poll <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;
