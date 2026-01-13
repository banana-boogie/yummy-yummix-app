import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { MaxWidthConfig, PageLayout } from '@/components/layouts/PageLayout';
import { AdminHeader } from '@/app/admin/_layout';

/**
 * AdminLayout - A consistent layout component for all admin pages
 * 
 * This component provides:
 * - Consistent header with navigation
 * - Sidebar on large screens
 * - No maxWidth constraints (for full width admin panels)
 * - Proper SafeAreaView integration
 * 
 * @example
 * <AdminLayout title="Manage Recipes" showBackButton={true}>
 *   <RecipesContent />
 * </AdminLayout>
 */
interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  showBackButton?: boolean;
  contentPaddingHorizontal?: number;
  disableMaxWidth?: boolean;
  disableSidebar?: boolean;
  maxWidth?: number | MaxWidthConfig
}


export function AdminLayout({
  children,
  title,
  showBackButton = false,
  contentPaddingHorizontal = 0,
  disableMaxWidth = true,
  maxWidth = 1000,
}: AdminLayoutProps) {

  return (
    <PageLayout
      adjustForTabBar={false}
      contentPaddingHorizontal={contentPaddingHorizontal}
      disableMaxWidth={disableMaxWidth}
      maxWidth={maxWidth}
      header={<AdminHeader title={title} showBackButton={showBackButton} maxWidth={maxWidth} />}
    >
      <View className="flex-1">
        <View className="flex-1">
          <View className="flex-1">
            {children}
          </View>
        </View>
      </View>
    </PageLayout>
  );
}