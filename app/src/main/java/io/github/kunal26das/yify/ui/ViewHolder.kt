package io.github.kunal26das.yify.ui

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.annotation.LayoutRes
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding
import androidx.recyclerview.widget.RecyclerView
import coil.ImageLoader
import coil.util.CoilUtils
import com.facebook.stetho.okhttp3.StethoInterceptor
import okhttp3.OkHttpClient

abstract class ViewHolder<T, V : ViewDataBinding>(
    parent: ViewGroup,
    @LayoutRes layoutId: Int,
) : RecyclerView.ViewHolder(
    DataBindingUtil.inflate<V>(
        LayoutInflater.from(parent.context),
        layoutId, parent, false
    ).root
) {

    protected val context: Context by lazy { parent.context }
    protected val binding by lazy { DataBindingUtil.findBinding<V>(itemView)!! }

    protected val imageLoader by lazy {
        ImageLoader.Builder(context).apply {
            availableMemoryPercentage(1.0)
            crossfade(true)
        }.okHttpClient {
            OkHttpClient.Builder().apply {
                addNetworkInterceptor(StethoInterceptor())
                cache(CoilUtils.createDefaultCache(context))
            }.build()
        }.build()
    }

    open fun bind(item: T?): V? {
        return binding
    }

}