package io.github.kunal26das.yify.core

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.annotation.LayoutRes
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding
import androidx.recyclerview.widget.RecyclerView

abstract class ViewHolder<T, V : ViewDataBinding>(
    parent: ViewGroup,
    @LayoutRes layoutId: Int,
) : RecyclerView.ViewHolder(
    DataBindingUtil.inflate<V>(
        LayoutInflater.from(parent.context),
        layoutId, parent, false
    ).root
) {

    protected val binding by lazy { DataBindingUtil.findBinding<V>(itemView)!! }

    open fun bind(item: T?): V? {
        return binding
    }

}