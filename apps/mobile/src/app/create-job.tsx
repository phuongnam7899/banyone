import React from 'react';
import { useColorScheme } from 'react-native';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

export default function CreateJobRoute() {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  return <CreateJobScreen colorScheme={colorScheme} />;
}
