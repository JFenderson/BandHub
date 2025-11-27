import { renderHook } from '@testing-library/react';
import { useRequireAuth } from '../useRequireAuth';
import * as navigation from 'next/navigation';
import * as authHook from '../useAuth';

jest.mock('next/navigation');

const push = jest.fn();
(jest.spyOn(navigation, 'useRouter') as jest.SpyInstance).mockReturnValue({ push } as any);

describe('useRequireAuth', () => {
  it('redirects when unauthenticated', () => {
    jest.spyOn(authHook, 'useAuth').mockReturnValue({ isAuthenticated: false, isLoading: false } as any);

    renderHook(() => useRequireAuth('/login'));

    expect(push).toHaveBeenCalledWith('/login');
  });

  it('does not redirect while loading', () => {
    jest.spyOn(authHook, 'useAuth').mockReturnValue({ isAuthenticated: false, isLoading: true } as any);

    renderHook(() => useRequireAuth('/login'));

    expect(push).not.toHaveBeenCalled();
  });
});
