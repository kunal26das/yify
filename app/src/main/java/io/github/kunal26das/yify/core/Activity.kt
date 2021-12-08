package io.github.kunal26das.yify.core

import android.os.Bundle
import android.os.StrictMode
import androidx.appcompat.app.AppCompatActivity
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding
import io.github.kunal26das.yify.BuildConfig
import io.github.kunal26das.yify.repository.DataStore

abstract class Activity : AppCompatActivity() {

    abstract val layoutId: Int

    protected fun Activity.dataStore() = lazy {
        DataStore.getInstance(this)
    }

    protected inline fun <reified T : ViewDataBinding> Activity.dataBinding() = lazy {
        DataBindingUtil.setContentView<T>(this, layoutId)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder().penaltyLog().detectAll().build()
            )
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder().penaltyLog().detectAll().build()
            )
        }
        super.onCreate(savedInstanceState)
    }

}