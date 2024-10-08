package io.github.kunal26das.yify.movies.domain.model

import androidx.annotation.Keep

@Keep
@Suppress("SpellCheckingInspection")
enum class Language {
    Abkhazian,
    Afrikaans,
    Akan,
    Albanian,
    Amharic,
    Arabic,
    Armenian,
    Azerbaijani,
    Bambara,
    Bangla,
    Basque,
    Belarusian,
    Bosnian,
    Bulgarian,
    Burmese,
    Cantonese,
    Catalan,
    Chinese,
    Croatian,
    Czech,
    Danish,
    Dutch,
    Dzongkha,
    English,
    Estonian,
    Finnish,
    French,
    Galician,
    Ganda,
    Georgian,
    German,
    Greek,
    Gujarati,
    Hebrew,
    Hindi,
    Hungarian,
    Icelandic,
    Indonesian,
    Irish,
    Italian,
    Japanese,
    Javanese,
    Kannada,
    Kazakh,
    Khmer,
    Kinyarwanda,
    Korean,
    Kurdish,
    Kyrgyz,
    Lao,
    Latin,
    Latvian,
    Lingala,
    Lithuanian,
    Macedonian,
    Malay,
    Malayalam,
    Maltese,
    Marathi,
    Mongolian,
    Nepali,
    Norwegian,
    Odia,
    Ossetic,
    Pashto,
    Persian,
    Polish,
    Portuguese,
    Punjabi,
    Romanian,
    Russian,
    Sanskrit,
    Serbian,
    Slovak,
    Slovenian,
    Somali,
    Spanish,
    Swahili,
    Swedish,
    Tagalog,
    Tamil,
    Telugu,
    Thai,
    Tibetan,
    Tswana,
    Turkish,
    Ukrainian,
    Urdu,
    Vietnamese,
    Welsh,
    Wolof,
    Xhosa,
    Yiddish,
    Yoruba,
    Zulu,
    Unknown,
    ;

    companion object {
        operator fun get(language: String?): Language? {
            return entries.find { it.name == language }
        }
    }
}