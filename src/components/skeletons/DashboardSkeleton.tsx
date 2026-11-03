import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { CardSpotlight } from '../ui/CardSpotlight';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Operations & Daily Accounting Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 backdrop-blur-md p-3.5 sm:px-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-48 rounded" />
              <Skeleton className="h-3.5 w-20 rounded" />
            </div>
            <Skeleton className="h-2.5 w-64 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>

      {/* 4 KPI Metrics Skeleton Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { color: 'rgba(2, 132, 199, 0.08)' },
          { color: 'rgba(16, 185, 129, 0.08)' },
          { color: 'rgba(99, 102, 241, 0.08)' },
          { color: 'rgba(245, 158, 11, 0.08)' },
        ].map((item, idx) => (
          <CardSpotlight key={idx} spotlightColor={item.color} className="p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-36 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
          </CardSpotlight>
        ))}
      </div>

      {/* Operational Grid: Dispatch Stream & Inventory Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Deliveries Stream Skeleton */}
        <div className="lg:col-span-7 xl:col-span-8">
          <CardSpotlight className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>

            {/* Delivery Items List Skeleton */}
            <div className="divide-y divide-slate-100 mt-3 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="pt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3.5 w-32 rounded" />
                        <Skeleton className="h-3.5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-2.5 w-44 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-5 w-14 rounded" />
                    <Skeleton className="h-7 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </CardSpotlight>
        </div>

        {/* Inventory Stock & Booking Skeleton */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Inventory Gauge Skeleton */}
          <CardSpotlight className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-2.5 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>

            <div className="py-4 flex justify-center">
              <Skeleton className="w-40 h-40 rounded-full" />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
            </div>
          </CardSpotlight>

          {/* Cooler & Event Orders Skeleton */}
          <CardSpotlight className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-2.5 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-7 w-22 rounded-lg" />
            </div>

            <div className="divide-y divide-slate-100 mt-2 space-y-2.5 pt-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="pt-2.5 flex items-center justify-between">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-28 rounded" />
                    <Skeleton className="h-2.5 w-36 rounded" />
                  </div>
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
              ))}
            </div>
          </CardSpotlight>
        </div>
      </div>
    </div>
  );
};
