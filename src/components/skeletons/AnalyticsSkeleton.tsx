import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { CardSpotlight } from '../ui/CardSpotlight';

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-3.5 w-64 rounded" />
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <CardSpotlight key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-3 w-36 rounded" />
          </CardSpotlight>
        ))}
      </div>

      {/* Main Charts / Distribution Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSpotlight className="p-5 space-y-4">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardSpotlight>
        <CardSpotlight className="p-5 space-y-4">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardSpotlight>
      </div>
    </div>
  );
};
