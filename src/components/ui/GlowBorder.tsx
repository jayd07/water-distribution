import React from 'react';

interface GlowBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'sky' | 'emerald' | 'indigo' | 'amber';
}

export const GlowBorder: React.FC<GlowBorderProps> = ({
  children,
  className = '',
  glowColor = 'sky',
  ...props
}) => {
  const glowGradients = {
    sky: 'from-sky-500/20 via-cyan-500/30 to-blue-500/20',
    emerald: 'from-emerald-500/20 via-teal-500/30 to-green-500/20',
    indigo: 'from-indigo-500/20 via-sky-500/30 to-violet-500/20',
    amber: 'from-amber-500/20 via-orange-500/30 to-yellow-500/20'
  };

  return (
    <div className={`relative p-px rounded-2xl group ${className}`} {...props}>
      <div
        className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${glowGradients[glowColor]} opacity-70 blur-xs transition-opacity duration-300 group-hover:opacity-100 -z-10`}
      />
      <div className="relative rounded-2xl bg-white h-full w-full">
        {children}
      </div>
    </div>
  );
};
