package io.github.kunal26das.core

import android.content.Context.MODE_PRIVATE
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.annotation.CallSuper
import androidx.databinding.DataBindingUtil
import androidx.databinding.ViewDataBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

abstract class BottomSheetDialogFragment : BottomSheetDialogFragment() {

    abstract val layoutId: Int
    var container: ViewGroup? = null

    protected fun BottomSheetDialogFragment.sharedPreferences(
        name: String? = requireContext().packageName
    ) = lazy {
        requireContext().getSharedPreferences(name, MODE_PRIVATE)
    }

    protected inline fun <reified T : ViewDataBinding> BottomSheetDialogFragment.dataBinding() =
        lazy {
            DataBindingUtil.inflate<T>(layoutInflater, layoutId, container, false)
        }

    @CallSuper
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        this.container = container
        return super.onCreateView(inflater, container, savedInstanceState)
    }

}