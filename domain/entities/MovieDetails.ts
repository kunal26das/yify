import type {CastMember} from './CastMember';
import type {Movie} from './Movie';
import type {Torrent} from './Torrent';

/** Full details for a single movie (the `movie_details` endpoint). */
export interface MovieDetails extends Movie {
    descriptionIntro?: string;
    descriptionFull: string;
    synopsis: string;
    ytTrailerCode: string;
    likeCount?: number;
    downloadCount?: number;
    /** Display-ready screenshot URLs. */
    screenshotUrls: string[];
    cast: CastMember[];
    torrents: Torrent[];
}
