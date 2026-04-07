type FilmRow = {
  tmdb_id: number;
  title?: string;
  overview?: string;
  genre_ids?: number[];
  release_year?: string;
  media_type?: string;
};

export const buildFilmEmbeddingInput = (film: FilmRow): string => {
  const parts: string[] = [];

  const title = film.title || "Unknown";
  parts.push(`Title: ${title}.`);

  if (film.overview) {
    parts.push(`Overview: ${film.overview}.`);
  }

  if (film.genre_ids && film.genre_ids.length > 0) {
    parts.push(`Genres: [${film.genre_ids.join(", ")}].`);
  }

  if (film.release_year) {
    parts.push(`Year: ${film.release_year}.`);
  }

  if (film.media_type) {
    parts.push(`Type: ${film.media_type}.`);
  }

  return parts.join(" ");
};
