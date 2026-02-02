import { useState, useCallback, useEffect } from 'react';

interface UseKeyboardNavigationOptions {
  itemCount: number;
  isActive: boolean;
  onSelect?: (index: number) => void;
  onEscape?: () => void;
  loop?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'both';
}

export function useKeyboardNavigation({
  itemCount,
  isActive,
  onSelect,
  onEscape,
  loop = true,
  orientation = 'vertical',
}: UseKeyboardNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isActive || itemCount === 0) return;

      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (e.key) {
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            setActiveIndex((prev) => {
              if (prev === -1) return 0;
              const next = prev + 1;
              if (next >= itemCount) return loop ? 0 : itemCount - 1;
              return next;
            });
          }
          break;

        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            setActiveIndex((prev) => {
              if (prev === -1) return itemCount - 1;
              const next = prev - 1;
              if (next < 0) return loop ? itemCount - 1 : 0;
              return next;
            });
          }
          break;

        case 'ArrowRight':
          if (isHorizontal) {
            e.preventDefault();
            setActiveIndex((prev) => {
              if (prev === -1) return 0;
              const next = prev + 1;
              if (next >= itemCount) return loop ? 0 : itemCount - 1;
              return next;
            });
          }
          break;

        case 'ArrowLeft':
          if (isHorizontal) {
            e.preventDefault();
            setActiveIndex((prev) => {
              if (prev === -1) return itemCount - 1;
              const next = prev - 1;
              if (next < 0) return loop ? itemCount - 1 : 0;
              return next;
            });
          }
          break;

        case 'Enter':
        case ' ':
          if (activeIndex >= 0 && onSelect) {
            e.preventDefault();
            onSelect(activeIndex);
          }
          break;

        case 'Escape':
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;

        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
      }
    },
    [isActive, itemCount, loop, orientation, activeIndex, onSelect, onEscape]
  );

  // Reset when becoming inactive
  useEffect(() => {
    if (!isActive) {
      setActiveIndex(-1);
    }
  }, [isActive]);

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
  };
}
