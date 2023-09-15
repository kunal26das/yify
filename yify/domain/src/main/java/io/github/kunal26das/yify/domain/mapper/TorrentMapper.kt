package io.github.kunal26das.yify.domain.mapper

import io.github.kunal26das.yify.domain.entity.TorrentEntity
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Torrent

val TorrentEntity.toTorrent
    get() = Torrent(
        hash = hash,
        dateUploaded = dateUploaded ?: 0,
        peers = peers ?: 0,
        quality = quality ?: Quality.Unknown,
        seeds = seeds ?: 0,
        size = size.orEmpty(),
        sizeBytes = sizeBytes ?: 0,
        type = type.orEmpty(),
        url = url,
    )

val List<TorrentEntity>?.toTorrents: List<Torrent>
    get() = this?.map { it.toTorrent }.orEmpty()