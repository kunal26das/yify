package io.github.kunal26das.yify.view

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import androidx.essentials.list.AbstractList.Companion.DEFAULT_ORIENTATION
import androidx.essentials.list.view.ListItemView
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemTorrentBinding
import io.github.kunal26das.yify.source.models.Torrent

class TorrentView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = R.attr.materialCardViewStyle,
    attachToRoot: Boolean = DEFAULT_ATTACH_TO_ROOT,
    listOrientation: Int = DEFAULT_ORIENTATION
) : ListItemView<Torrent, ItemTorrentBinding>(
    context, attrs, defStyleAttr, attachToRoot, listOrientation
) {

    override val binding = ItemTorrentBinding.inflate(
        LayoutInflater.from(context), this, attachToRoot
    )

    init {
        radius = 0f
        cardElevation = 0f
    }

    override fun bind(item: Torrent) {
        binding.apply {
            torrent = item
        }
    }

}