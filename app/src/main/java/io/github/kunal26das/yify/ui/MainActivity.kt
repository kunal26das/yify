package io.github.kunal26das.yify.ui

import android.os.Bundle
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.core.Activity
import io.github.kunal26das.yify.ui.netflix.NetflixActivity

@AndroidEntryPoint
class MainActivity : Activity() {

    private val viewModel by viewModels<MainViewModel>()

    private val moviesActivity = registerForActivityResult(MoviesActivity.Contract())
    private val netflixActivity = registerForActivityResult(NetflixActivity.Contract())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installSplashScreen().setKeepOnScreenCondition {
            viewModel.loading.value
        }
//        viewModel.enqueueMoviesWork()
        moviesActivity.launch().finish()
    }
}