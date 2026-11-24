import type {
  CastMember,
  ListMoviesParams,
  ListMoviesResult,
  Movie,
  MovieDetails,
  MovieRepository,
  ParentalGuide,
  Torrent,
} from '@/domain';
import type {YtsApi} from '../datasources/YtsApiDataSource';
import type {YtsCastMemberDto, YtsMovieDto, YtsTorrentDto} from '../models';
import {artworkUrl} from './support/artwork';

function present(url: string | undefined): url is string {
  return url != null;
}

export class MovieRepositoryImpl implements MovieRepository {
  constructor(private readonly api: YtsApi) {
  }

  async listMovies(params: ListMoviesParams): Promise<ListMoviesResult> {
    const response = await this.api.listMovies({
      page: params.page,
      limit: params.limit ?? 20,
      query: params.query,
      quality: params.quality,
      minimum_rating: params.minimum_rating,
      genre: params.genre,
      sort_by: params.sort_by,
      order_by: params.order_by,
    });

    const movies = (response.data.movies ?? []).map((m) => this.toMovie(m));

    const {page_number, movie_count, limit} = response.data;
    const loadedCount = page_number * limit;
    const receivedCount = movies.length;
    const limitUsed = params.limit ?? 20;
    const hasMore =
        receivedCount > 0 && (loadedCount < movie_count || receivedCount >= limitUsed);

    return {
      movies,
      pageNumber: page_number,
      movieCount: movie_count,
      hasMore,
    };
  }

  async getMovieDetails(movieId: number): Promise<MovieDetails> {
    const response = await this.api.getMovieDetails({
      movie_id: movieId,
      with_images: true,
      with_cast: true,
    });
    return this.toMovieDetails(response.data.movie);
  }

  async getMovieSuggestions(movieId: number): Promise<Movie[]> {
    const response = await this.api.getMovieSuggestions(movieId);
    return (response.data.movies ?? []).map((m) => this.toMovie(m));
  }

  async getMovieParentalGuides(movieId: number): Promise<ParentalGuide[]> {
    const response = await this.api.getMovieParentalGuides(movieId);
    return (response.data.parental_guides ?? []).map((g) => ({
      type: g.type,
      text: g.parental_guide_text,
    }));
  }

  private toPosterUrls(dto: YtsMovieDto): string[] {
    const ladder = [dto.medium_cover_image, dto.large_cover_image].map(artworkUrl).filter(present);
    if (ladder.length > 0) return [...new Set(ladder)];
    const small = artworkUrl(dto.small_cover_image);
    return small ? [small] : [];
  }

  private toBackdropUrl(dto: YtsMovieDto): string | undefined {
    return artworkUrl(dto.background_image_original) ?? artworkUrl(dto.background_image);
  }

  private toScreenshotUrls(dto: YtsMovieDto): string[] {
    return [
      artworkUrl(dto.large_screenshot_image1) ?? artworkUrl(dto.medium_screenshot_image1),
      artworkUrl(dto.large_screenshot_image2) ?? artworkUrl(dto.medium_screenshot_image2),
      artworkUrl(dto.large_screenshot_image3) ?? artworkUrl(dto.medium_screenshot_image3),
    ].filter(present);
  }

  private toMovie(dto: YtsMovieDto): Movie {
    const backdrop = this.toBackdropUrl(dto);
    return {
      id: dto.id,
      imdbCode: dto.imdb_code,
      title: dto.title,
      titleLong: dto.title_long,
      year: dto.year,
      rating: dto.rating,
      runtimeMinutes: dto.runtime,
      genres: (dto.genres ?? []).filter(
          (genre): genre is string => typeof genre === 'string' && genre.trim().length > 0
      ),
      summary: dto.summary,
      language: dto.language,
      mpaRating: dto.mpa_rating,
      posterUrls: this.toPosterUrls(dto),
      backgroundImageUrl: backdrop,
      ytTrailerCode: dto.yt_trailer_code || undefined,
      thumbnailUrls: backdrop ? [backdrop] : undefined,
    };
  }

  private toTorrent(dto: YtsTorrentDto): Torrent {
    return {
      url: dto.url,
      hash: dto.hash,
      quality: dto.quality,
      type: dto.type,
      videoCodec: dto.video_codec,
      bitDepth: dto.bit_depth,
      audioChannels: dto.audio_channels,
      seeds: dto.seeds,
      peers: dto.peers,
      size: dto.size,
      sizeBytes: dto.size_bytes,
      uploadedAt: new Date(dto.date_uploaded_unix * 1000),
    };
  }

  private toCastMember(dto: YtsCastMemberDto): CastMember {
    return {
      name: dto.name,
      character: dto.character_name,
      imdbCode: dto.imdb_code,
      imageUrl: artworkUrl(dto.url_small_image),
    };
  }

  private toMovieDetails(dto: YtsMovieDto): MovieDetails {
    const screenshotUrls = this.toScreenshotUrls(dto);
    return {
      ...this.toMovie(dto),
      descriptionIntro: dto.description_intro,
      descriptionFull: dto.description_full,
      synopsis: dto.synopsis,
      ytTrailerCode: dto.yt_trailer_code,
      likeCount: dto.like_count,
      downloadCount: dto.download_count,
      screenshotUrls,
      screenshotThumbUrls: screenshotUrls,
      cast: (dto.cast ?? []).map((c) => this.toCastMember(c)),
      torrents: (dto.torrents ?? []).map((t) => this.toTorrent(t)),
    };
  }
}
