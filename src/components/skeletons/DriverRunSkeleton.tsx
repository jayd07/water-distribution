import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { CardSpotlight } from '../ui/CardSpotlight';

export const DriverRunSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Dark Dispatch Hero Card Skeleton */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl bg-slate-800" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-44 rounded-md bg-slate-800" />
                <Skeleton className="h-5 w-20 rounded-full bg-slate-800" />
              </div>
              <Skeleton className="h-3.5 w-64 rounded bg-slate-800" />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-9 w-32 rounded-xl bg-slate-800" />
            <Skeleton className="h-9 w-28 rounded-xl bg-slate-800" />
            <Skeleton className="h-9 w-36 rounded-xl bg-sky-900/60" />
          </div>
        </div>

        {/* Telemetry HUD Skeleton */}
        <div className="pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1.5">
              <Skeleton className="h-3 w-20 rounded bg-slate-800" />
              <Skeleton className="h-5 w-24 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Route Selector Bar Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-xl" />
      </div>

      {/* Route Stops Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <CardSpotlight key={i} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
              <Skeleton className="h-2 w-full rounded" />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-9 flex-1 rounded-xl" />
              <Skeleton className="h-9 w-12 rounded-xl" />
            </div>
          </CardSpotlight>
        ))}
      </div>
    </div>
  );
};
