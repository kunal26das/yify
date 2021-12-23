package io.github.kunal26das.network.singleton

import android.content.Context
import android.content.Context.MODE_PRIVATE
import android.net.ConnectivityManager
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.components.ViewModelComponent
import dagger.hilt.android.qualifiers.ApplicationContext
import io.github.kunal26das.network.local.RoomDatabaseProvider
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
import io.reactivex.rxjava3.disposables.CompositeDisposable
import io.reactivex.rxjava3.schedulers.Schedulers
import retrofit2.Retrofit
import java.io.Closeable

@Module
@InstallIn(ViewModelComponent::class)
abstract class Repository(
    @ApplicationContext context: Context
) : ConnectivityManager.NetworkCallback(), RoomDatabaseProvider, Closeable {

    private val ioThread = Schedulers.io()
    val applicationContext = context.applicationContext!!
    private val mainThread = AndroidSchedulers.mainThread()
    private val compositeDisposable = CompositeDisposable()
    private val packageName = applicationContext.packageName

    protected inline fun <reified T> Repository.retrofit(retrofit: Singleton<Retrofit>) = lazy {
        retrofit.get().create(T::class.java)
    }

    protected fun Repository.sharedPreferences(
        name: String = packageName,
        encrypt: Boolean = true,
    ) = lazy {
        if (encrypt) try {
            EncryptedSharedPreferences.create(
                name, MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
                applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Throwable) {
            applicationContext.getSharedPreferences(name, MODE_PRIVATE)
        } else applicationContext.getSharedPreferences(name, MODE_PRIVATE)
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