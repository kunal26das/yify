package io.github.kunal26das.yify.movie

import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.fragment.app.FragmentContainerView
import androidx.fragment.app.FragmentManager
import androidx.fragment.app.FragmentTransaction
import androidx.fragment.app.commit
import coil.compose.AsyncImage
import io.github.kunal26das.model.Movie

@OptIn(ExperimentalMaterial3Api::class)
interface Composables {

    @Composable
    fun FragmentContainer(
        modifier: Modifier = Modifier,
        fragmentManager: FragmentManager,
        commit: FragmentTransaction.(containerId: Int) -> Unit
    ) {
        val containerId by remember { mutableStateOf(View.generateViewId()) }
        AndroidView(
            modifier = modifier,
            factory = { context ->
                fragmentManager.findFragmentById(containerId)?.view
                    ?.also { (it.parent as? ViewGroup)?.removeView(it) }
                    ?: FragmentContainerView(context)
                        .apply { id = containerId }
                        .also {
                            fragmentManager.commit { commit(it.id) }
                        }
            }
        )
    }

    @Composable
    fun MovieCard(
        modifier: Modifier = Modifier,
        movie: Movie?,
        onClick: (() -> Unit) = {},
    ) {
        ElevatedCard(
            modifier = modifier,
            onClick = onClick,
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = movie?.title,
                model = movie?.coverImage,
            )
        }
    }

}