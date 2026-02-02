'use client';

import { AccessibleModal } from '@/components/ui/AccessibleModal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['/'], description: 'Focus search' },
      { keys: ['Ctrl', 'K'], description: 'Focus search (alternative)' },
      { keys: ['Tab'], description: 'Move to next element' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous element' },
    ],
  },
  {
    category: 'Modals & Dialogs',
    shortcuts: [
      { keys: ['Esc'], description: 'Close modal or dropdown' },
      { keys: ['Enter'], description: 'Confirm action' },
    ],
  },
  {
    category: 'Lists & Menus',
    shortcuts: [
      { keys: ['↑'], description: 'Move up in list' },
      { keys: ['↓'], description: 'Move down in list' },
      { keys: ['Home'], description: 'Go to first item' },
      { keys: ['End'], description: 'Go to last item' },
      { keys: ['Enter'], description: 'Select item' },
      { keys: ['Space'], description: 'Select item (alternative)' },
    ],
  },
  {
    category: 'Video Player',
    shortcuts: [
      { keys: ['Space'], description: 'Play/Pause' },
      { keys: ['K'], description: 'Play/Pause (alternative)' },
      { keys: ['M'], description: 'Toggle mute' },
      { keys: ['←'], description: 'Seek backward 5s' },
      { keys: ['→'], description: 'Seek forward 5s' },
      { keys: ['J'], description: 'Seek backward 10s' },
      { keys: ['L'], description: 'Seek forward 10s' },
      { keys: ['F'], description: 'Toggle fullscreen' },
      { keys: ['0-9'], description: 'Jump to percentage' },
    ],
  },
  {
    category: 'Help',
    shortcuts: [{ keys: ['?'], description: 'Show this help dialog' }],
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <AccessibleModal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="space-y-6">
        {shortcutGroups.map((group) => (
          <div key={group.category}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              {group.category}
            </h3>
            <div className="space-y-2">
              {group.shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {shortcut.description}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex} className="flex items-center">
                        <kbd className="kbd">{key}</kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="mx-1 text-gray-400">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Press <kbd className="kbd">?</kbd> anywhere to show this dialog
        </p>
      </div>
    </AccessibleModal>
  );
}
