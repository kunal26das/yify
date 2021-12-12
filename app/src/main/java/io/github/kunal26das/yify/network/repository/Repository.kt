package io.github.kunal26das.yify.network.repository

import android.content.Context
import android.content.Context.MODE_PRIVATE
import android.net.ConnectivityManager
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.components.ViewModelComponent
import io.github.kunal26das.yify.network.local.RoomDatabaseProvider
import io.github.kunal26das.yify.service.Service
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
import io.reactivex.rxjava3.disposables.CompositeDisposable
import io.reactivex.rxjava3.schedulers.Schedulers
import retrofit2.Retrofit
import java.io.Closeable

@Module
@InstallIn(ViewModelComponent::class)
abstract class Repository(context: Context) : ConnectivityManager.NetworkCallback(),
    RoomDatabaseProvider, Closeable {

    private val ioThread = Schedulers.io()
    val applicationContext = context.applicationContext!!
    private val mainThread = AndroidSchedulers.mainThread()
    private val compositeDisposable = CompositeDisposable()
    private val packageName = applicationContext.packageName

    protected inline fun <reified T> Repository.retrofit(retrofit: Service<Retrofit>) = lazy {
        retrofit.get().create(T::class.java)
    }

    protected fun Repository.sharedPreferences(name: String = packageName) = lazy {
        applicationContext.getSharedPreferences(name, MODE_PRIVATE)
    }

    protected inline fun <reified T> Repository.systemService() = lazy {
        applicationContext.getSystemService(T::class.java)
    }

    protected fun Completable.enqueue(
        onComplete: ((Throwable?) -> Unit)? = null
    ) {
        compositeDisposable.add(
            observeOn(mainThread)
                .subscribeOn(ioThread)
                .subscribe({
                    onComplete?.invoke(null)
                }, {
                    onComplete?.invoke(it)
                })
        )
    }

    protected fun <T : Any> Single<T>.enqueue(
        onComplete: ((T?) -> Unit)? = null
    ) {
        compositeDisposable.add(
            observeOn(mainThread)
                .subscribeOn(ioThread)
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

}