package io.github.kunal26das.yify.movie.filter

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.children
import androidx.core.widget.doAfterTextChanged
import com.google.android.material.chip.Chip
import io.github.kunal26das.core.BottomSheetDialogFragment
import io.github.kunal26das.model.*
import io.github.kunal26das.model.Movie.Companion.KEY_MOVIE
import io.github.kunal26das.network.local.get
import io.github.kunal26das.network.local.set
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ChipFilterBinding
import io.github.kunal26das.yify.databinding.FragmentFiltersBinding

class MovieFilterFragment : BottomSheetDialogFragment() {

    override val layoutId = R.layout.fragment_filters
    private val binding by dataBinding<FragmentFiltersBinding>()
    private val moviePreferences by sharedPreferences(KEY_MOVIE)
    private var onChangeListener: OnChangeListener<*>? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        super.onCreateView(inflater, container, savedInstanceState)
        Quality.forEach { quality ->
            val chip = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            chip.id = quality.hashCode()
            chip.text = quality
            binding.quality.addView(chip)
        }
        Genre.forEach { sortBy ->
            val chip = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            chip.id = sortBy.hashCode()
            chip.text = sortBy
            binding.genre.addView(chip)
        }
        SortBy.forEach { sortBy ->
            val chip = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            chip.id = sortBy.hashCode()
            chip.text = sortBy
            binding.sortBy.addView(chip)
        }
        OrderBy.forEach { orderBy ->
            val chip = ChipFilterBinding.inflate(LayoutInflater.from(context)).chip
            chip.id = orderBy.hashCode()
            chip.text = orderBy
            binding.orderBy.addView(chip)
        }
        moviePreferences.get<String>(Preference.Quality)?.hashCode()?.let {
            binding.quality.check(it)
        }
        moviePreferences.get<Int>(Preference.MinimumRating)?.let {
            binding.rating.value = it.toFloat()
        }
        moviePreferences.get<String>(Preference.QueryTerm)?.let {
            binding.query.setText(it)
        }
        moviePreferences.get<String>(Preference.Genre)?.hashCode()?.let {
            binding.genre.check(it)
        }
        moviePreferences.get<String>(Preference.SortBy)?.hashCode()?.let {
            binding.sortBy.check(it)
        }
        moviePreferences.get<String>(Preference.OrderBy)?.hashCode()?.let {
            binding.orderBy.check(it)
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.quality.setOnCheckedChangeListener { group, _ ->
            val quality = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.Quality] = quality
            onChangeListener?.invoke(null)
        }
        binding.rating.addOnChangeListener { _, value, fromUser ->
            if (fromUser) {
                moviePreferences[Preference.MinimumRating] = value.toInt()
                onChangeListener?.invoke(null)
            }
        }
        binding.query.doAfterTextChanged {
            moviePreferences[Preference.QueryTerm] = it.toString()
            onChangeListener?.invoke(null)
        }
        binding.genre.setOnCheckedChangeListener { group, _ ->
            val genre = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.Genre] = genre
            onChangeListener?.invoke(null)
        }
        binding.sortBy.setOnCheckedChangeListener { group, _ ->
            val sortBy = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.SortBy] = sortBy
            onChangeListener?.invoke(null)
        }
        binding.orderBy.setOnCheckedChangeListener { group, _ ->
            val orderBy = (group.children.firstOrNull {
                (it as Chip).isChecked
            } as? Chip)?.text.toString()
            moviePreferences[Preference.OrderBy] = orderBy
            onChangeListener?.invoke(null)
        }
    }

    fun setOnFiltersChangeListener(
        onChangeListener: OnChangeListener<*>
    ) {
        this.onChangeListener = onChangeListener
    }

}