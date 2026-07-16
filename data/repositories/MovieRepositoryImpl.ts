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
import type {YtsApi, YtsCastMemberDto, YtsMovieDto, YtsTorrentDto} from '@/data';

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

  private upgradeHttpUrlToHttps(url: string): string {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.href;
    }
    return url;
  }

  private toDisplayImageUrl(
      url: string | undefined,
      width: number,
      opts?: {quality?: number; noEnlarge?: boolean},
  ): string | null {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = this.upgradeHttpUrlToHttps(trimmed);
    const quality = opts?.quality ?? 80;
    const withoutEnlargement = opts?.noEnlarge ? '&we' : '';
    return `https://wsrv.nl/?url=${encodeURIComponent(normalized)}&w=${width}&fit=cover&output=webp&q=${quality}${withoutEnlargement}`;
  }

  private toPosterUrls(dto: YtsMovieDto): string[] {
    return [
      {url: dto.small_cover_image, width: 240},
      {url: dto.medium_cover_image, width: 480},
      {url: dto.large_cover_image, width: 720},
    ]
        .map(({url, width}) => this.toDisplayImageUrl(url, width))
        .filter((url): url is string => url != null);
  }

  private toScreenshotUrls(dto: YtsMovieDto): string[] {
    return [
      dto.large_screenshot_image1 ?? dto.medium_screenshot_image1,
      dto.large_screenshot_image2 ?? dto.medium_screenshot_image2,
      dto.large_screenshot_image3 ?? dto.medium_screenshot_image3,
    ]
        .map((url) => this.toDisplayImageUrl(url, 1280))
        .filter((url): url is string => url != null);
  }

  private toMovie(dto: YtsMovieDto): Movie {
    return {
      id: dto.id,
      imdbCode: dto.imdb_code,
      title: dto.title,
      titleLong: dto.title_long,
      year: dto.year,
      rating: dto.rating,
      runtimeMinutes: dto.runtime,
      genres: dto.genres ?? [],
      summary: dto.summary,
      language: dto.language,
      mpaRating: dto.mpa_rating,
      posterUrls: this.toPosterUrls(dto),
      backgroundImageUrl:
          this.toDisplayImageUrl(dto.background_image_original ?? dto.background_image, 2560, {
            quality: 90,
            noEnlarge: true,
          }) ?? undefined,
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
      imageUrl: this.toDisplayImageUrl(dto.url_small_image, 96) ?? undefined,
    };
  }

  private toMovieDetails(dto: YtsMovieDto): MovieDetails {
    return {
      ...this.toMovie(dto),
      descriptionIntro: dto.description_intro,
      descriptionFull: dto.description_full,
      synopsis: dto.synopsis,
      ytTrailerCode: dto.yt_trailer_code,
      likeCount: dto.like_count,
      downloadCount: dto.download_count,
      screenshotUrls: this.toScreenshotUrls(dto),
      cast: (dto.cast ?? []).map((c) => this.toCastMember(c)),
      torrents: (dto.torrents ?? []).map((t) => this.toTorrent(t)),
    };
  }
}
