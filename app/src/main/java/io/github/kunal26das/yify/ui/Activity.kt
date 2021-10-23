package io.github.kunal26das.yify.ui

import androidx.appcompat.app.AppCompatActivity
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding

abstract class Activity : AppCompatActivity() {

    abstract val layoutId: Int

    protected inline fun <reified T : ViewDataBinding> Activity.dataBinding() = lazy {
        DataBindingUtil.setContentView<T>(this, layoutId)
    }

}