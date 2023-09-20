package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.dto.TorrentDto
import io.github.kunal26das.yify.domain.entity.TorrentEntity
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Torrent
import java.util.Locale

fun TorrentDto.toTorrent(movieId: Int) = Torrent(
    hash = hash,
    dateUploaded = dateUploadedUnix?.toLong() ?: 0,
    movieId = movieId,
    peers = peers ?: 0,
    quality = quality?.toQuality ?: Quality.Unknown,
    seeds = seeds ?: 0,
    size = size.orEmpty(),
    sizeBytes = sizeBytes ?: 0,
    type = type?.capitalize().orEmpty(),
    url = url,
)

fun TorrentDto.toEntity(movieId: Int): TorrentEntity {
    return TorrentEntity(
        hash = hash,
        movieId = movieId,
        dateUploaded = dateUploadedUnix?.toLong(),
        peers = peers,
        quality = quality?.toQuality,
        seeds = seeds,
        size = size,
        sizeBytes = sizeBytes,
        type = type?.capitalize(),
        url = url,
    )
}

fun List<TorrentDto>?.toTorrents(movieId: Int): List<Torrent> {
    return this?.map { it.toTorrent(movieId) } ?: emptyList()
}

fun List<TorrentDto>?.toEntities(movieId: Int): List<TorrentEntity> {
    return this?.map { it.toEntity(movieId) } ?: emptyList()
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