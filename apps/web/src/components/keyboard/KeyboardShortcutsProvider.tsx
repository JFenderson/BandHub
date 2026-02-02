'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

interface KeyboardShortcutsContextValue {
  openHelpModal: () => void;
  closeHelpModal: () => void;
  isHelpModalOpen: boolean;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcuts must be used within KeyboardShortcutsProvider'
    );
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const openHelpModal = useCallback(() => setIsHelpModalOpen(true), []);
  const closeHelpModal = useCallback(() => setIsHelpModalOpen(false), []);

  // Global keyboard shortcut for ? to open help modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      const isTyping =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable;

      if (isTyping) return;

      // ? key opens help modal (Shift + /)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsHelpModalOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <KeyboardShortcutsContext.Provider
      value={{ openHelpModal, closeHelpModal, isHelpModalOpen }}
    >
      {children}
      <KeyboardShortcutsModal isOpen={isHelpModalOpen} onClose={closeHelpModal} />
    </KeyboardShortcutsContext.Provider>
  );
}
