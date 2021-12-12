package io.github.kunal26das.yify.launcher

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import io.github.kunal26das.yify.firebase.RemoteConfig
import io.github.kunal26das.yify.movie.list.MovieListActivity

class LauncherActivity : AppCompatActivity() {

    private val movieListActivity = registerForActivityResult(MovieListActivity) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        RemoteConfig.fetchAndActivate {
            movieListActivity.launch(null)
            finish()
        }
    }

}