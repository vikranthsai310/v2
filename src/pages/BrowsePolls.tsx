import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useWeb3 } from "@/contexts/Web3Context";
import { Poll, timeRemaining, formatAddress } from "@/utils/contract";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Search, 
  User,
  Users, 
  Filter, 
  Lock, 
  Unlock,
  BarChart,
  Clock,
  RefreshCw
} from "lucide-react";

const PollCard = ({ poll }: { poll: Poll }) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">
          <Link 
            to={`/polls/${poll.id}`}
            className="hover:text-primary transition-colors"
          >
            {poll.title}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="address">{formatAddress(poll.creator)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-grow">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{timeRemaining(poll.endTime)}</span>
          </div>
          
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{poll.voterCount}/{poll.maxVoters}</span>
          </div>
          
          <div className="flex items-center gap-1">
            {poll.isPublic ? (
              <Unlock className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-orange-500" />
            )}
          </div>
        </div>
        
        <Separator />
        
        <div className="text-sm text-muted-foreground">
          <p>{poll.candidateCount} candidates</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link to={`/polls/${poll.id}`}>
            View Poll
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

const PollCardSkeleton = () => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3 flex-grow">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
        </div>
        
        <Separator />
        
        <Skeleton className="h-4 w-24" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  );
};

const BrowsePolls = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { contract, address } = useWeb3();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [filteredPolls, setFilteredPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  const loadPolls = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setError("");
      
      const count = await contract.getPollsCount();
      const pollCount = count.toNumber();
      
      const pollsData: Poll[] = [];
      
      for (let i = 0; i < pollCount; i++) {
        try {
          const [
            title,
            creator,
            endTime,
            candidateCount,
            isPublic,
            voterCount,
            maxVoters
          ] = await contract.getPollDetails(i);
          
          pollsData.push({
            id: i,
            title,
            creator,
            endTime: endTime.toNumber(),
            candidateCount: candidateCount,
            isPublic,
            voterCount: voterCount.toNumber(),
            maxVoters: maxVoters.toNumber()
          });
        } catch (err) {
          console.error(`Error loading poll ${i}:`, err);
          // Continue with next poll if one fails
        }
      }
      
      setPolls(pollsData);
      setFilteredPolls(pollsData);
      
      // Notify user that polls have been refreshed
      toast.info("Poll data has been refreshed");
    } catch (err: any) {
      console.error("Error loading polls:", err);
      setError("Failed to load polls: " + (err.message || "Unknown error"));
      toast.error("Failed to load polls: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };
  
  // Force refresh when component mounts or when returning to this page
  useEffect(() => {
    console.log("Loading polls (useEffect triggered)");
    loadPolls();
  }, [contract, address, location.key]);
  
  // Force an immediate refresh when navigating to this page
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath === '/browse') {
      console.log("On browse page - forcing refresh");
      loadPolls();
    }
  }, [location.pathname]);
  
  // Filter polls when filters change
  useEffect(() => {
    if (!polls.length) return;
    
    let filtered = [...polls];
    const now = Math.floor(Date.now() / 1000);
    
    if (searchTerm) {
      filtered = filtered.filter(poll => 
        poll.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter === "active") {
      filtered = filtered.filter(poll => poll.endTime > now);
    } else if (statusFilter === "ended") {
      filtered = filtered.filter(poll => poll.endTime <= now);
    }
    
    if (typeFilter === "public") {
      filtered = filtered.filter(poll => poll.isPublic);
    } else if (typeFilter === "private") {
      filtered = filtered.filter(poll => !poll.isPublic);
    }
    
    setFilteredPolls(filtered);
  }, [polls, searchTerm, statusFilter, typeFilter]);
  
  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    loadPolls();
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Browse Polls</h1>
          <p className="text-muted-foreground">
            Discover and participate in active polls
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} title="Refresh polls">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button asChild>
            <Link to="/create">
              Create Poll
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="bg-muted/30 p-4 rounded-lg mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search polls..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Select 
              value={statusFilter} 
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[140px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
            
            <Select 
              value={typeFilter} 
              onValueChange={setTypeFilter}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <PollCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <BarChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">Error loading polls</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={handleRefresh}>
            Try Again
          </Button>
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="text-center py-12">
          <BarChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No polls found</h3>
          <p className="text-muted-foreground mb-6">
            {polls.length === 0 
              ? "There are no polls created yet." 
              : "No polls match your search criteria."}
          </p>
          <Button asChild>
            <Link to="/create">Create Your First Poll</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolls.map(poll => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowsePolls;
