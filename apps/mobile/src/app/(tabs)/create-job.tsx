import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CreateJobRoute() {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  return <CreateJobScreen colorScheme={colorScheme} />;
}
