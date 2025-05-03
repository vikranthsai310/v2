
import React, { ReactNode } from "react";
import Navbar from "./Navbar";
import { useWeb3 } from "@/contexts/Web3Context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { error } = useWeb3();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {error && (
        <div className="container mt-4">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
      
      <main className="flex-1 container py-8">{children}</main>
      
      <footer className="border-t py-6 bg-muted/40">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <p>© 2024 PolyVote. All rights reserved.</p>
          </div>
          <div className="flex gap-4">
            <a 
              href="#" 
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
            <a 
              href="#"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
