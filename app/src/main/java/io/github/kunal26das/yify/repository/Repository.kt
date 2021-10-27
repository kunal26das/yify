package io.github.kunal26das.yify.repository

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.room.Room
import androidx.room.RoomDatabase
import com.facebook.stetho.okhttp3.StethoInterceptor
import com.google.gson.GsonBuilder
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.components.ViewModelComponent
import dagger.hilt.android.qualifiers.ApplicationContext
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
import io.reactivex.rxjava3.disposables.CompositeDisposable
import io.reactivex.rxjava3.schedulers.Schedulers
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.Retrofit.Builder
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory
import java.io.Closeable

@Module
@InstallIn(ViewModelComponent::class)
abstract class Repository(
    @ApplicationContext protected val applicationContext: Context,
    networkRequestBuilder: NetworkRequest.Builder.() -> Unit = {
        addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
    }
) : ConnectivityManager.NetworkCallback(), Closeable {

    private var isNetworkAvailable = false
        @Synchronized get
        @Synchronized set

    private val ioThread by lazy { Schedulers.io() }
    private val compositeDisposable = CompositeDisposable()
    private val mainThread by lazy { AndroidSchedulers.mainThread() }

    private val connectivityManager: ConnectivityManager =
        applicationContext.getSystemService(ConnectivityManager::class.java).also {
            it.registerNetworkCallback(NetworkRequest.Builder().apply {
                networkRequestBuilder.invoke(this)
            }.build(), this)
        }

    protected inline fun <reified T> Repository.service() = lazy {
        Retrofit.create(T::class.java)
    }

    protected inline fun <reified T : RoomDatabase> Repository.database(
        name: String = applicationContext.packageName,
        crossinline roomDatabaseBuilder: RoomDatabase.Builder<T>.() -> Unit = {
            fallbackToDestructiveMigration()
        }
    ) = lazy {
        Room.databaseBuilder(applicationContext, T::class.java, name).apply {
            roomDatabaseBuilder.invoke(this)
        }.build()
    }

    override fun onAvailable(network: Network) {
        super.onAvailable(network)
        isNetworkAvailable = true
    }

    override fun onLost(network: Network) {
        isNetworkAvailable = false
        super.onLost(network)
    }

    override fun onUnavailable() {
        super.onUnavailable()
        isNetworkAvailable = false
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
        connectivityManager.unregisterNetworkCallback(this)
    }

    companion object {

        private const val BASE_URL = "https://yts.mx/api/v2/"

        private val Gson = GsonBuilder().create()

        private val OkHttp = OkHttpClient.Builder().apply {
            addNetworkInterceptor(StethoInterceptor())
            retryOnConnectionFailure(true)
        }.build()

        protected val Retrofit: Retrofit = Builder().apply {
            client(OkHttp)
            baseUrl(BASE_URL)
            addConverterFactory(GsonConverterFactory.create(Gson))
            addCallAdapterFactory(RxJava3CallAdapterFactory.create())
        }.build()

    }

}