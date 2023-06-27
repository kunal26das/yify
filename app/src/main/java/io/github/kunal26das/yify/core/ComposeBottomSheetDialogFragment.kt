package io.github.kunal26das.yify.core

import android.os.Bundle
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import io.github.kunal26das.yify.theme.YifyTheme

abstract class ComposeBottomSheetDialogFragment : BottomSheetDialogFragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ) = ComposeView(requireContext()).also {
        it.setContent {
            YifyTheme {
                Content()
            }
        }
    }

    @Composable
    abstract fun Content()
}