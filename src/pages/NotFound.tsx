import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-6 text-center">
      <div className="space-y-8 max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">404</h1>
        <h2 className="text-3xl font-semibold">Page Not Found</h2>
        
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Button asChild className="mt-6">
          <Link to="/">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}