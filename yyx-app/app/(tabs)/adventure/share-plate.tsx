import React from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
import { PageLayout } from '@/components/layouts/PageLayout';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { Text } from '@/components/common/Text';
import { IrmixyGuide } from '@/components/adventure/IrmixyGuide';

const SharePlate = () => {
  return (
    <PageLayout
      scrollEnabled={true}
      header={<HeaderWithBack title={i18n.t('adventure.community.sharePlate.title')} />}
      contentContainerStyle={{ paddingBottom: 140 }}
    >
      <View className="py-md">
        <Text preset="body" className="text-sm text-grey-dark">
          {i18n.t('adventure.community.sharePlate.stub')}
        </Text>
      </View>
      <IrmixyGuide message={i18n.t('adventure.irmixy.sharePlateHint')} />
    </PageLayout>
  );
};

export default SharePlate;
