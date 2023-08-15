package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.model.TorrentModel
import io.github.kunal26das.yify.domain.model.Torrent

val TorrentModel.toTorrent: Torrent
    get() = Torrent(
        hash = hash,
        dateUploaded = dateUploadedUnix?.toLong() ?: 0,
        peers = peers ?: 0,
        quality = quality.orEmpty(),
        seeds = seeds ?: 0,
        size = size.orEmpty(),
        sizeBytes = sizeBytes ?: 0,
        type = type.orEmpty(),
        url = url,
    )

val List<TorrentModel>?.toTorrents: List<Torrent>
    get() = this?.map { it.toTorrent } ?: emptyList()