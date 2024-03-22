package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.data.dto.TorrentDto
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.Torrent
import java.util.Locale

fun TorrentDto.toTorrent(movieId: Long?) = Torrent(
    hash = hash.orEmpty(),
    dateUploaded = dateUploadedUnix ?: 0,
    movieId = movieId,
    peers = peers ?: 0,
    quality = quality?.toQuality ?: Quality.Unknown,
    seeds = seeds ?: 0,
    size = size.orEmpty(),
    sizeBytes = sizeBytes ?: 0,
    type = type?.capitalize().orEmpty(),
    url = url,
)

fun List<TorrentDto>?.toTorrents(movieId: Long?): List<Torrent> {
    return this?.map { it.toTorrent(movieId) } ?: emptyList()
}

val List<TorrentDto>?.bestQuality: Quality?
    get() = this?.mapNotNull { it.quality?.toQuality }?.maxByOrNull { it.value }

val List<TorrentDto>?.maxPeers: Int
    get() = this?.maxOf { it.peers ?: 0 } ?: 0

val List<TorrentDto>?.maxSeeds: Int
    get() = this?.maxOf { it.seeds ?: 0 } ?: 0

fun String.capitalize(
    locale: Locale = Locale.getDefault()
) = replaceFirstChar {
    when {
        it.isLowerCase() -> it.titlecase(locale)
        else -> it.toString()
    }
}