package io.github.kunal26das.yify.ui

import android.Manifest
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.core.Activity

@AndroidEntryPoint
class MainActivity : Activity() {

    private val viewModel by viewModels<MainViewModel>()
    private val moviesActivity = registerForActivityResult(MoviesActivity.Contract())
    private val requestPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            viewModel.enqueueMoviesWork()
            moviesActivity.launch()
            finish()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}