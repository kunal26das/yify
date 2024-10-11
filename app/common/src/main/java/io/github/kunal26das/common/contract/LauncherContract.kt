package io.github.kunal26das.common.contract

import android.app.Activity.RESULT_OK
import android.content.Context
import android.content.Intent
import androidx.activity.result.contract.ActivityResultContract

class LauncherContract : ActivityResultContract<Any?, Boolean>() {
    override fun createIntent(context: Context, input: Any?): Intent {
        return context.packageManager.getLaunchIntentForPackage(context.packageName)!!
    }

    override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
        return resultCode == RESULT_OK
    }
}