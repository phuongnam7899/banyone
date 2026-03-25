import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ConstraintGuidance } from '@/features/create-job/components/constraint-guidance';
import { MediaSlotPicker } from '@/features/create-job/components/media-slot-picker';
import { useJobInputSelection } from '@/features/create-job/hooks/use-job-input-selection';

type Props = {
  colorScheme: 'light' | 'dark';
};

export function CreateJobScreen({ colorScheme }: Props) {
  const colors = Colors[colorScheme];
  const { state, pickVideo, pickImage, clearVideo, clearImage } = useJobInputSelection();

  return (
    <ThemedView style={styles.container} testID="create-job.screen">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.four }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              New creation
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Pick one source video and one reference image. Limits below match what we will validate before submit.
            </ThemedText>
          </View>

          <ConstraintGuidance colorScheme={colorScheme} />

          <MediaSlotPicker
            variant="video"
            colorScheme={colorScheme}
            label="Source video"
            helper="Choose a single video from your library. Replacing picks swaps the clip in this slot."
            uri={state.videoUri}
            displayName={state.videoLabel}
            testID="create-job.upload-video.button"
            accessibilityLabel="Choose source video from library"
            onPress={pickVideo}
            onClear={clearVideo}
          />

          <MediaSlotPicker
            variant="image"
            colorScheme={colorScheme}
            label="Reference image"
            helper="Choose one still image. This slot only accepts photos—not another video."
            uri={state.imageUri}
            displayName={state.imageLabel}
            testID="create-job.upload-image.button"
            accessibilityLabel="Choose reference image from library"
            onPress={pickImage}
            onClear={clearImage}
          />

          <View style={styles.footerNote} accessibilityRole="text">
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Submission and deep validation arrive in the next stories; here you will always see the same limits the
              validators will use.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    textAlign: 'left',
  },
  footerNote: {
    marginTop: Spacing.two,
  },
});
