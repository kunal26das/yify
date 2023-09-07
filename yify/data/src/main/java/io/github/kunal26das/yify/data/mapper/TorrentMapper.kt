package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.dto.TorrentDto
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Torrent

val TorrentDto.toTorrent: Torrent
    get() = Torrent(
        hash = hash,
        dateUploaded = dateUploadedUnix?.toLong() ?: 0,
        peers = peers ?: 0,
        quality = quality?.toQuality ?: Quality.Unknown,
        seeds = seeds ?: 0,
        size = size.orEmpty(),
        sizeBytes = sizeBytes ?: 0,
        type = type.orEmpty(),
        url = url,
    )

val List<TorrentDto>?.toTorrents: List<Torrent>
    get() = this?.map { it.toTorrent } ?: emptyList()