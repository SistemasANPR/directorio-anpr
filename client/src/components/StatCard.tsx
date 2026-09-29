import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
}

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  description = "vs. mes anterior",
  className = "" 
}: StatCardProps) {
  return (
    <Card className={`${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center">
            <Icon className="text-primary text-xl" />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center">
            <span className={`text-sm ${trend.isPositive ? "text-secondary" : "text-destructive"}`}>
              <i className={`fas fa-arrow-${trend.isPositive ? "up" : "down"} mr-1`}></i>
              {Math.abs(trend.value)}%
            </span>
            <span className="text-sm text-gray-500 ml-2">{description}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
