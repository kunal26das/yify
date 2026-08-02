import { useLocalSearchParams } from 'expo-router';
import { WatchScreen, useMovieDetailsViewModel, useMovieRepository } from '@/presentation';

export default function MovieDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewModel = useMovieDetailsViewModel(useMovieRepository(), Number(id));
  return <WatchScreen viewModel={viewModel} />;
}
