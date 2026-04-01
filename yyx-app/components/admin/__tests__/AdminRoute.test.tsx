import React from 'react';
import { renderWithProviders, screen } from '@/test/utils/render';
import { AdminRoute } from '../AdminRoute';
import { Text } from '@/components/common/Text';

let mockAuthValue = { user: null as any, loading: false };
let mockProfileValue = { isAdmin: false, loading: false };

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => mockProfileValue,
}));

describe('AdminRoute', () => {
  beforeEach(() => {
    mockAuthValue = { user: null, loading: false };
    mockProfileValue = { isAdmin: false, loading: false };
  });

  it('renders spinner when auth is loading', () => {
    mockAuthValue = { user: null, loading: true };
    renderWithProviders(
      <AdminRoute><Text preset="body">Admin Content</Text></AdminRoute>
    );
    expect(screen.queryByText('Admin Content')).toBeNull();
  });

  it('renders spinner when profile is loading', () => {
    mockAuthValue = { user: { id: 'u1' }, loading: false };
    mockProfileValue = { isAdmin: false, loading: true };
    renderWithProviders(
      <AdminRoute><Text preset="body">Admin Content</Text></AdminRoute>
    );
    expect(screen.queryByText('Admin Content')).toBeNull();
  });

  it('renders login prompt when no user', () => {
    mockAuthValue = { user: null, loading: false };
    mockProfileValue = { isAdmin: false, loading: false };
    renderWithProviders(
      <AdminRoute><Text preset="body">Admin Content</Text></AdminRoute>
    );
    expect(screen.queryByText('Admin Content')).toBeNull();
    expect(screen.getByText(/log in/i)).toBeTruthy();
  });

  it('renders access denied when authenticated but not admin', () => {
    mockAuthValue = { user: { id: 'u1' }, loading: false };
    mockProfileValue = { isAdmin: false, loading: false };
    renderWithProviders(
      <AdminRoute><Text preset="body">Admin Content</Text></AdminRoute>
    );
    expect(screen.queryByText('Admin Content')).toBeNull();
    expect(screen.getByText(/access denied/i)).toBeTruthy();
  });

  it('renders children when user is admin', () => {
    mockAuthValue = { user: { id: 'u1' }, loading: false };
    mockProfileValue = { isAdmin: true, loading: false };
    renderWithProviders(
      <AdminRoute><Text preset="body">Admin Content</Text></AdminRoute>
    );
    expect(screen.getByText('Admin Content')).toBeTruthy();
  });
});
