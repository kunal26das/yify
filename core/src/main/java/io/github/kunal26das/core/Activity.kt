package io.github.kunal26das.core

import android.os.Bundle
import android.os.StrictMode
import androidx.appcompat.app.AppCompatActivity
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding

abstract class Activity : AppCompatActivity() {

    abstract val layoutId: Int

    protected inline fun <reified T : ViewDataBinding> Activity.dataBinding() = lazy {
        DataBindingUtil.setContentView<T>(this, layoutId)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        if (BuildConfig.DEBUG) {
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder().penaltyLog().detectAll().build()
            )
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder().penaltyLog().detectAll().build()
            )
        }
        super.onCreate(savedInstanceState)
    }

}