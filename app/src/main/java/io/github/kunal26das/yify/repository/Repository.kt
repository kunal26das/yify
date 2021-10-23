package io.github.kunal26das.yify.repository

import com.facebook.stetho.okhttp3.StethoInterceptor
import com.google.gson.GsonBuilder
import io.reactivex.Single
import io.reactivex.android.schedulers.AndroidSchedulers
import io.reactivex.disposables.CompositeDisposable
import io.reactivex.schedulers.Schedulers
import okhttp3.OkHttpClient
import retrofit2.Retrofit.Builder
import retrofit2.adapter.rxjava2.RxJava2CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory
import java.io.Closeable

abstract class Repository : Closeable {

    private val compositeDisposable = CompositeDisposable()

    protected inline fun <reified T> Repository.service(): Lazy<T> {
        return lazyOf(Retrofit.create(T::class.java))
    }

    protected fun <T> Single<T>.enqueue(
        onComplete: ((T?) -> Unit)? = null
    ) {
        compositeDisposable.add(
            observeOn(AndroidSchedulers.mainThread())
                .subscribeOn(Schedulers.io())
                .subscribe({
                    onComplete?.invoke(it)
                }, {
                    onComplete?.invoke(null)
                })
        )
    }

    override fun close() {
        compositeDisposable.clear()
    }

    companion object {

        private const val BASE_URL = "https://yts.mx/api/v2/"

        private val Gson = GsonBuilder().create()

        private val OkHttp = OkHttpClient.Builder().apply {
            networkInterceptors().add(StethoInterceptor())
            retryOnConnectionFailure(true)
        }.build()

        protected val Retrofit = Builder().apply {
            client(OkHttp)
            baseUrl(BASE_URL)
            addConverterFactory(GsonConverterFactory.create(Gson))
            addCallAdapterFactory(RxJava2CallAdapterFactory.create())
        }.build()

    }

}