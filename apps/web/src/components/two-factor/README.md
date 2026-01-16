# Two-Factor Authentication Components

This directory contains all components related to Two-Factor Authentication (2FA) setup and management.

## Components

### 1. TwoFactorSetupWizard
A complete multi-step wizard for setting up 2FA.

**Features:**
- Step 1: Introduction explaining 2FA benefits
- Step 2: QR code display with manual entry option
- Step 3: Verification code input
- Step 4: Backup codes display and confirmation
- Progress indicator showing current step
- Navigation (Next/Back/Cancel)
- Dark mode support

**Usage:**
```tsx
import { TwoFactorSetupWizard } from '@/components/two-factor';

function MyComponent() {
  const tokenProvider = () => localStorage.getItem('authToken');
  
  return (
    <TwoFactorSetupWizard
      tokenProvider={tokenProvider}
      onComplete={() => console.log('2FA enabled!')}
      onCancel={() => console.log('Setup cancelled')}
    />
  );
}
```

### 2. QRCodeDisplay
Displays a QR code for authenticator app scanning.

**Features:**
- QR code image display
- Manual entry code with copy button
- Instruction text
- Dark mode support

**Usage:**
```tsx
import { QRCodeDisplay } from '@/components/two-factor';

function MyComponent() {
  return (
    <QRCodeDisplay
      qrCodeDataUrl="data:image/png;base64,..."
      secret="JBSWY3DPEHPK3PXP"
    />
  );
}
```

### 3. BackupCodesDisplay
Displays and manages backup codes.

**Features:**
- Grid layout for codes
- Copy all codes
- Download as text file
- Print codes
- Confirmation checkboxes
- Warning messages
- Dark mode support

**Usage:**
```tsx
import { BackupCodesDisplay } from '@/components/two-factor';

function MyComponent() {
  const codes = ['AAAA-BBBB', 'CCCC-DDDD', ...];
  
  return (
    <BackupCodesDisplay
      codes={codes}
      onConfirmSaved={() => console.log('User confirmed')}
      requireConfirmation={true}
    />
  );
}
```

### 4. TwoFactorVerificationInput
A 6-digit code input component.

**Features:**
- 6 separate input boxes
- Auto-advance on input
- Paste support (splits code across inputs)
- Backspace/Delete support
- Arrow key navigation
- Loading and error states
- Accessible
- Dark mode support

**Usage:**
```tsx
import { TwoFactorVerificationInput } from '@/components/two-factor';

function MyComponent() {
  const [code, setCode] = useState('');
  
  return (
    <TwoFactorVerificationInput
      value={code}
      onChange={setCode}
      onComplete={(value) => console.log('Code entered:', value)}
      loading={false}
      error={false}
    />
  );
}
```

## Hook

### use2FA
Custom hook for all 2FA operations.

**Features:**
- Generate secret
- Enable/disable 2FA
- Verify tokens
- Regenerate backup codes
- Check status
- Loading and error states

**Usage:**
```tsx
import { use2FA } from '@/hooks/use2FA';

function MyComponent() {
  const tokenProvider = () => localStorage.getItem('authToken');
  const {
    setupData,
    backupCodes,
    status,
    isGenerating,
    error,
    generateSecret,
    enable2FA,
    disable2FA,
    verify2FA,
    regenerateBackupCodes,
    getStatus,
  } = use2FA(tokenProvider);
  
  // Use the hook methods...
}
```

## API Integration

All components use the `getTwoFactorApiClient` from `@/lib/api/two-factor.ts`.

The API client expects the following endpoints:
- `POST /auth/mfa/setup` - Generate secret and QR code
- `POST /auth/mfa/enable` - Enable 2FA with token
- `POST /auth/mfa/disable` - Disable 2FA
- `POST /auth/mfa/verify` - Verify token
- `POST /auth/mfa/backup-codes/regenerate` - Regenerate backup codes
- `GET /auth/mfa/status` - Get 2FA status

## Accessibility

All components follow accessibility best practices:
- Proper ARIA labels and attributes
- Keyboard navigation support
- Focus management
- Screen reader friendly
- High contrast support in dark mode

## Dark Mode

All components support dark mode using Tailwind CSS dark mode classes. The theme automatically adapts based on the user's system preference or app theme setting.
