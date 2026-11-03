import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { CardSpotlight } from '../ui/CardSpotlight';

export const CustomerSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-56 rounded" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-full sm:w-44 rounded-xl" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
      </div>

      {/* Customers Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <CardSpotlight key={i} className="p-4 space-y-3">
            {/* Top row: Avatar + Name + Type Tag */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Address & Route */}
            <div className="space-y-1.5 py-1 border-t border-b border-slate-100/80">
              <Skeleton className="h-3 w-4/5 rounded" />
              <Skeleton className="h-3 w-3/5 rounded" />
            </div>

            {/* Metric counters: Jars & Due */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50/60 p-2.5 rounded-xl">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-12 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-14 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
            </div>
          </CardSpotlight>
        ))}
      </div>
    </div>
  );
};
