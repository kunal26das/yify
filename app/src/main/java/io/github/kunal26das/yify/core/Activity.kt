package io.github.kunal26das.yify.core

import androidx.appcompat.app.AppCompatActivity
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding
import io.github.kunal26das.yify.repository.DataStore

abstract class Activity : AppCompatActivity() {

    abstract val layoutId: Int

    protected fun Activity.dataStore() = lazy {
        DataStore.getInstance(this)
    }

    protected inline fun <reified T : ViewDataBinding> Activity.dataBinding() = lazy {
        DataBindingUtil.setContentView<T>(this, layoutId)
    }

}