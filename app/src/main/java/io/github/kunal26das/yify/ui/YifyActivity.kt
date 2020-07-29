package io.github.kunal26das.yify.ui

import android.os.Bundle
import android.view.MenuItem
import android.view.WindowManager
import androidx.coordinatorlayout.widget.CoordinatorLayout
import androidx.essentials.core.Activity
import androidx.navigation.findNavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.navigateUp
import androidx.navigation.ui.setupActionBarWithNavController
import com.google.android.material.navigation.NavigationView
import io.github.kunal26das.yify.R
import kotlinx.android.synthetic.main.toolbar.*
import io.github.kunal26das.yify.utils.Constants.HEIGHT_STATUS_BAR
import io.github.kunal26das.yify.utils.Constants.TOOLBAR_MARGIN_HORIZONTAL
import io.github.kunal26das.yify.utils.Constants.TOOLBAR_MARGIN_VERTICAL

class YifyActivity : Activity(), NavigationView.OnNavigationItemSelectedListener {

    override val layout = R.layout.activity_yify
    private lateinit var appBarConfiguration: AppBarConfiguration
    override val viewModel by viewModel<YifyViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )
        initToolbar()
        initNavigation()
    }

    private fun initToolbar() {
        (toolbarWrapper?.layoutParams as CoordinatorLayout.LayoutParams).apply {
            setMargins(
                TOOLBAR_MARGIN_HORIZONTAL,
                TOOLBAR_MARGIN_VERTICAL + HEIGHT_STATUS_BAR,
                TOOLBAR_MARGIN_HORIZONTAL, 0
            )
        }
        setSupportActionBar(toolbar)
    }

    private fun initNavigation() {
        val navController =
            (supportFragmentManager.findFragmentById(R.id.app_navigation_fragment) as NavHostFragment).navController
        appBarConfiguration = AppBarConfiguration(navController.graph)
        setupActionBarWithNavController(navController, appBarConfiguration)
    }

    override fun onNavigationItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            else -> onOptionsItemSelected(item)
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        return findNavController(R.id.app_navigation_fragment).navigateUp(appBarConfiguration)
    }

}
