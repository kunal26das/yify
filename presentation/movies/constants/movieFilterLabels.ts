import {Genre, OrderBy, Quality, SortBy} from '@/domain';

export const QUALITY_OPTIONS = [
  { value: Quality.All, label: 'All' },
  { value: Quality.P480, label: '480p' },
  { value: Quality.P720, label: '720p' },
  { value: Quality.P1080, label: '1080p' },
  { value: Quality.P1080X265, label: '1080p x265' },
  { value: Quality.P2160, label: '2160p' },
  { value: Quality.ThreeD, label: '3D' },
];

export const SORT_BY_OPTIONS = [
  { value: SortBy.DateAdded, label: 'Date added' },
  { value: SortBy.Title, label: 'Title' },
  { value: SortBy.Year, label: 'Year' },
  { value: SortBy.Rating, label: 'Rating' },
  { value: SortBy.DownloadCount, label: 'Downloads' },
  { value: SortBy.LikeCount, label: 'Likes' },
  { value: SortBy.Seeds, label: 'Seeds' },
  { value: SortBy.Peers, label: 'Peers' },
];

export const ORDER_OPTIONS = [
  { value: OrderBy.Desc, label: 'Descending' },
  { value: OrderBy.Asc, label: 'Ascending' },
];

export const GENRE_OPTIONS = [
  { value: Genre.All, label: 'All' },
  { value: Genre.Action, label: 'Action' },
  { value: Genre.Adventure, label: 'Adventure' },
  { value: Genre.Animation, label: 'Animation' },
  { value: Genre.Comedy, label: 'Comedy' },
  { value: Genre.Crime, label: 'Crime' },
  { value: Genre.Documentary, label: 'Documentary' },
  { value: Genre.Drama, label: 'Drama' },
  { value: Genre.Fantasy, label: 'Fantasy' },
  { value: Genre.Horror, label: 'Horror' },
  { value: Genre.Mystery, label: 'Mystery' },
  { value: Genre.Romance, label: 'Romance' },
  { value: Genre.SciFi, label: 'Sci-Fi' },
  { value: Genre.Thriller, label: 'Thriller' },
  { value: Genre.War, label: 'War' },
  { value: Genre.Western, label: 'Western' },
];

export const RATING_OPTIONS = [
  { value: 0, label: 'Any' },
  ...Array.from({ length: 9 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}+`,
  })),
];
