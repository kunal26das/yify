/** A cast member of a movie. */
export interface CastMember {
    name: string;
    character: string;
    imdbCode?: string;
    /** Display-ready headshot URL, if available. */
    imageUrl?: string;
}
