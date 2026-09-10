import type {ListMoviesParams, ListMoviesResult, Movie, MovieDetails, MovieRepository, ParentalGuide} from '@/domain';
import {WebCatalogClient} from '../datasources/WebCatalogClient';

export class WebMovieRepositoryImpl implements MovieRepository {
    constructor(private readonly client: WebCatalogClient = new WebCatalogClient()) {}

    listMovies(params: ListMoviesParams): Promise<ListMoviesResult> {
        return this.client.listMovies(params);
    }

    getMovieDetails(movieId: number): Promise<MovieDetails> {
        return this.client.getMovieDetails(movieId);
    }

    getMovieSuggestions(movieId: number): Promise<Movie[]> {
        return this.client.getMovieSuggestions(movieId);
    }

    getMovieParentalGuides(movieId: number): Promise<ParentalGuide[]> {
        return this.client.getMovieParentalGuides(movieId);
    }
}
