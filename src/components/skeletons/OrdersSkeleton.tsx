import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { CardSpotlight } from '../ui/CardSpotlight';

export const OrdersSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-3.5 w-60 rounded" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Orders Filter & Search */}
      <div className="bg-white/80 backdrop-blur-md p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Orders Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <CardSpotlight key={i} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl space-y-1.5">
              <Skeleton className="h-3.5 w-40 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
              <Skeleton className="h-4 w-16 rounded" />
              <div className="flex gap-1.5">
                <Skeleton className="h-7 w-16 rounded-lg" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            </div>
          </CardSpotlight>
        ))}
      </div>
    </div>
  );
};
