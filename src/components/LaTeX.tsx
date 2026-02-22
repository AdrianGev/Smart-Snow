import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface LaTeXProps {
  children: string;
  block?: boolean;
  className?: string;
}

export const LaTeX: React.FC<LaTeXProps> = ({ children, block = false, className = '' }) => {
  try {
    if (block) {
      return (
        <div className={`my-2 ${className}`}>
          <BlockMath math={children} />
        </div>
      );
    } else {
      return (
        <span className={className}>
          <InlineMath math={children} />
        </span>
      );
    }
  } catch (error) {
    console.warn('LaTeX rendering error:', error);
    return (
      <code className={`bg-red-100 text-red-800 px-1 rounded ${className}`}>
        {children}
      </code>
    );
  }
};
