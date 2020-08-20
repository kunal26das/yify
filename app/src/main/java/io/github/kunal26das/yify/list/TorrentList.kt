package io.github.kunal26das.yify.list

import android.content.Context
import android.util.AttributeSet
import android.view.ViewGroup
import androidx.essentials.list.List
import io.github.kunal26das.yify.databinding.ItemTorrentBinding
import io.github.kunal26das.yify.source.models.Torrent
import io.github.kunal26das.yify.view.TorrentView

class TorrentList @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : List<Torrent, ItemTorrentBinding>(context, attrs) {

    override fun onCreateViewHolder(parent: ViewGroup) =
        TorrentView(
            attachToRoot = false,
            context = parent.context,
            listOrientation = orientation
        ).viewHolder
}