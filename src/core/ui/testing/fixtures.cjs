function title(id, name, year, overrides = {}) {
  const type = overrides.type ?? 'movie';
  return {
    kind: 'title',
    title: {
      key: `${type}:${id}`,
      type,
      id,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: name,
      originalTitle: name,
      year,
      releaseDate: null,
      overview: '',
      posterPath: '/abcdefghijk.jpg',
      backdropPath: null,
      rating: 7.84,
      voteCount: 1200,
      genreIds: [],
      originalLanguage: 'en',
      ...overrides,
    },
  };
}

function entry(key, name, year = null, posterPath = null) {
  return {kind: 'entry', key, snapshot: {title: name, year, posterPath, slug: ''}};
}

const PROVIDER = {id: 8, name: 'Netflix', logoPath: '/netflixlogo.jpg', priority: 1};

module.exports = {PROVIDER, entry, title};
