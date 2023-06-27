package io.github.kunal26das.yify.core

import android.os.Bundle
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView
import androidx.fragment.app.Fragment
import io.github.kunal26das.yify.theme.YifyTheme

abstract class ComposeFragment : Fragment() {
    fun <I, O> registerForActivityResult(
        contract: ActivityResultContract<I, O>,
    ) = registerForActivityResult(contract) {}

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