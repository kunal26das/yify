package io.github.kunal26das.yify.presentation

import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.core.YifyActivity
import io.github.kunal26das.yify.movies.presentation.MoviesActivity

@AndroidEntryPoint
class MainActivity : YifyActivity() {

    private val moviesActivity = registerForActivityResult(MoviesActivity.Contract())

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        splashScreen.setKeepOnScreenCondition { true }
        moviesActivity.launch().finish()
    }
}