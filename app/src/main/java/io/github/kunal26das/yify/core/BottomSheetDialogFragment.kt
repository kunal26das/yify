package io.github.kunal26das.yify.core

import android.content.Context.MODE_PRIVATE
import androidx.essentials.view.BottomSheetDialogFragment
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

abstract class BottomSheetDialogFragment : BottomSheetDialogFragment() {

    protected fun BottomSheetDialogFragment.sharedPreferences(
        name: String, encrypt: Boolean = true
    ) = lazy {
        val applicationContext = requireContext().applicationContext
        if (encrypt) try {
            EncryptedSharedPreferences.create(
                name, MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
                applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Throwable) {
            applicationContext.getSharedPreferences(name, MODE_PRIVATE)
        } else applicationContext.getSharedPreferences(name, MODE_PRIVATE)
    }

}