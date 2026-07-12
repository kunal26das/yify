import type {CastMember} from './CastMember';
import type {Movie} from './Movie';
import type {Torrent} from './Torrent';

export interface MovieDetails extends Movie {
    descriptionIntro?: string;
    descriptionFull: string;
    synopsis: string;
    ytTrailerCode: string;
    likeCount?: number;
    downloadCount?: number;
    screenshotUrls: string[];
    cast: CastMember[];
    torrents: Torrent[];
}
