import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  as: Component = 'div'
}) => {
  return (
    <Component className={`max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </Component>
  );
};
